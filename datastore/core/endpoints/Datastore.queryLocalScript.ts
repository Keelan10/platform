import { SqlParser } from '@ulixee/sql-engine';
import DatastoreApiHandler from '../lib/DatastoreApiHandler';
import LocalDatastoreProcess from '../lib/LocalDatastoreProcess';
import { DatastoreNotFoundError } from '../lib/errors';
import DatastoreStorage from '../lib/DatastoreStorage';
import SqlQuery from '../lib/SqlQuery';

export default new DatastoreApiHandler('Datastore.queryLocalScript', {
  async handler(request, context) {
    const datastoreProcess = new LocalDatastoreProcess(request.scriptPath);
    const meta = await datastoreProcess.fetchMeta();
    const storage = new DatastoreStorage();

    const db = storage.db;
    const sqlParser = new SqlParser(request.sql);
    if (!sqlParser.isSelect()) throw new Error('Invalid SQL command');

    const schemas = Object.keys(meta.runnersByName).reduce((obj, k) => {
      return Object.assign(obj, { [k]: meta.runnersByName[k].schema.input });
    }, {});
    const inputByFunctionName = sqlParser.extractFunctionCallInputs(schemas, request.boundValues);
    const outputByFunctionName: { [name: string]: any[] } = {};

    for (const functionName of Object.keys(inputByFunctionName)) {
      const input = inputByFunctionName[functionName];
      const runner = meta.runnersByName[functionName] ?? meta.crawlersByName[functionName];
      if (!runner)
        throw new DatastoreNotFoundError(
          `${functionName} is not available on the requested datastore`,
        );

      for (const pluginName of Object.keys(runner.corePlugins)) {
        if (!context.pluginCoresByName[pluginName]) {
          throw new Error(`Miner does not support required datastore plugin: ${pluginName}`);
        }
      }

      outputByFunctionName[functionName] = await context.workTracker.trackRun(
        datastoreProcess.run(functionName, input).then(x => x),
      );
    }

    const boundValues = sqlParser.convertToBoundValuesSqliteMap(request.boundValues);
    const sqlQuery = new SqlQuery(sqlParser, storage, db);
    const records = sqlQuery.execute(inputByFunctionName, outputByFunctionName, {}, boundValues);
    await datastoreProcess.close();

    return { outputs: records, latestVersionHash: null };
  },
});
