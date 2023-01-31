import Datastore, { IRunnerExecOptions } from '@ulixee/datastore';
import IDatastoreApis from '@ulixee/specification/datastore/DatastoreApis';
import { SqlGenerator } from '@ulixee/sql-engine';
import DatastoreApiHandler from '../lib/DatastoreApiHandler';
import DatastoreCore from '../index';
import PaymentProcessor from '../lib/PaymentProcessor';
import DatastoreVm from '../lib/DatastoreVm';
import { validateAuthentication, validateRunnerCoreVersions } from '../lib/datastoreUtils';
import { IDatastoreManifestWithStats } from '../lib/DatastoreRegistry';
import IDatastoreApiContext from '../interfaces/IDatastoreApiContext';
import DatastoreStorage from '../lib/DatastoreStorage';

export default new DatastoreApiHandler('Datastore.stream', {
  async handler(request, context) {
    const startTime = Date.now();
    const manifestWithStats = await context.datastoreRegistry.getByVersionHash(request.versionHash);
    const datastore = await DatastoreVm.open(manifestWithStats.path, manifestWithStats);
    await validateAuthentication(datastore, request.payment, request.authentication);
    const paymentProcessor = new PaymentProcessor(request.payment, datastore, context);

    let outputs;

    const datastoreRunner = datastore.metadata.runnersByName[request.name];
    const datastoreTable = datastore.metadata.tablesByName[request.name];
    if (datastoreRunner) {
      outputs = await extractRunnerOutputs(
        manifestWithStats,
        datastore,
        request,
        context,
        paymentProcessor,
      );
    } else if (datastoreTable) {
      // TODO: Need to put a payment hold for tables
      outputs = await extractTableOutputs(datastore, request, context);
    } else {
      throw new Error(`${request.name} is not a valid Runner name for this Datastore.`);
    }

    const bytes = PaymentProcessor.getOfficialBytes(outputs);
    const microgons = await paymentProcessor.settle(bytes);
    const milliseconds = Date.now() - startTime;
    context.datastoreRegistry.recordStats(request.versionHash, request.name, {
      bytes,
      microgons,
      milliseconds,
    });

    return {
      latestVersionHash: manifestWithStats.latestVersionHash,
      metadata: {
        bytes,
        microgons,
        milliseconds,
      },
    };
  },
});

async function extractRunnerOutputs(
  manifestWithStats: IDatastoreManifestWithStats,
  datastore: Datastore,
  request: IDatastoreApis['Datastore.stream']['args'],
  context: IDatastoreApiContext,
  paymentProcessor: PaymentProcessor,
): Promise<any[]> {
  await paymentProcessor.createHold(
    manifestWithStats,
    [{ runnerName: request.name, id: 1 }],
    request.pricingPreferences,
  );

  validateRunnerCoreVersions(manifestWithStats, request.name, context);

  return await context.workTracker.trackRun(
    (async () => {
      const options: IRunnerExecOptions<any> = {
        input: request.input,
        authentication: request.authentication,
        affiliateId: request.affiliateId,
        payment: request.payment,
      };

      for (const plugin of Object.values(DatastoreCore.pluginCoresByName)) {
        if (plugin.beforeExecRunner) await plugin.beforeExecRunner(options);
      }

      const results = datastore.runners[request.name].runInternal(options);
      for await (const result of results) {
        context.connectionToClient.sendEvent({
          listenerId: request.streamId,
          data: result,
          eventType: 'RunnerStream.output',
        });
      }
      return results;
    })(),
  );
}

async function extractTableOutputs(
  datastore: Datastore,
  request: IDatastoreApis['Datastore.stream']['args'],
  context: IDatastoreApiContext,
): Promise<any[]> {
  let storage: DatastoreStorage;
  if (request.versionHash) {
    storage = await context.datastoreRegistry.getStorage(request.versionHash);
  } else {
    context.connectionToClient.datastoreStorage ??= new DatastoreStorage();
    storage = context.connectionToClient?.datastoreStorage;
  }

  const db = storage.db;
  const schema = storage.getTableSchema(request.name);
  const { sql, boundValues } = SqlGenerator.createWhereClause(request.name, request.input, ['*'], 1000);

  const results = db.prepare(sql).all(boundValues);

  SqlGenerator.convertRecordsFromSqlite(results, [schema]);

  for (const result of results) {
    context.connectionToClient.sendEvent({
      listenerId: request.streamId,
      data: result,
      eventType: 'RunnerStream.output',
    });
  }

  return results;
}
