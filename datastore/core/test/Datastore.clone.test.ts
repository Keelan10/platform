import * as Fs from 'fs';
import * as Path from 'path';
import DatastorePackager from '@ulixee/datastore-packager';
import UlixeeMiner from '@ulixee/miner';
import DatastoreApiClient from '@ulixee/datastore/lib/DatastoreApiClient';
import cloneDatastore from '@ulixee/datastore/cli/cloneDatastore';
import { Helpers } from '@ulixee/datastore-testing';

const storageDir = Path.resolve(process.env.ULX_DATA_DIR ?? '.', 'Datastore.clone.test');

let miner: UlixeeMiner;
let client: DatastoreApiClient;
let versionHash: string;

beforeAll(async () => {
  if (Fs.existsSync(`${__dirname}/datastores/cloneme.dbx`)) {
    Fs.unlinkSync(`${__dirname}/datastores/cloneme.dbx`);
  }

  if (Fs.existsSync(`${__dirname}/datastores/cloneme.dbx.build`)) {
    Fs.rmSync(`${__dirname}/datastores/cloneme.dbx.build`, { recursive: true });
  }

  if (Fs.existsSync(`${__dirname}/datastores/cloned.dbx`)) {
    Fs.unlinkSync(`${__dirname}/datastores/cloned.dbx`);
  }

  miner = new UlixeeMiner();
  miner.router.datastoreConfiguration = {
    datastoresDir: storageDir,
    datastoresTmpDir: Path.join(storageDir, 'tmp'),
  };
  await miner.listen();
  client = new DatastoreApiClient(await miner.address, true);

  const packager = new DatastorePackager(`${__dirname}/datastores/cloneme.ts`);
  await packager.build();
  await client.upload(await packager.dbx.asBuffer());
  versionHash = packager.manifest.versionHash;
}, 45e3);

afterEach(Helpers.afterEach);

afterAll(async () => {
  await miner.close();
  if (Fs.existsSync(storageDir)) Fs.rmSync(storageDir, { recursive: true });
});

test('should be able to clone a datastore', async () => {
  const url = `ulx://${await miner.address}/datastore/${versionHash}`;
  await expect(cloneDatastore(url, `${__dirname}/datastores/cloned`)).resolves.toBeUndefined();

  expect(Fs.existsSync(`${__dirname}/datastores/cloned/datastore.ts`)).toBeTruthy();
  const packager = new DatastorePackager(`${__dirname}/datastores/cloned/datastore.ts`);
  await packager.build();
  await client.upload(await packager.dbx.asBuffer());

  // should not include a private table
  expect(Object.entries(packager.manifest.tablesByName)).toHaveLength(1);
  expect(packager.manifest.tablesByName.private).not.toBeTruthy();
  expect(packager.manifest.tablesByName.users.schemaAsJson).toEqual({
    name: { typeName: 'string' },
    birthdate: { typeName: 'date' },
  });
  expect(Object.entries(packager.manifest.runnersByName)).toHaveLength(1);
  expect(packager.manifest.runnersByName.cloneUpstream.schemaAsJson).toEqual({
    input: {
      field: { typeName: 'string', minLength: 1, description: 'a field you should use' },
      nested: {
        typeName: 'object',
        fields: {
          field2: { typeName: 'boolean' },
        },
        optional: true,
      },
    },
    output: {
      success: { typeName: 'boolean' },
      affiliateId: { typeName: 'string' },
    },
  });

  await expect(
    client.stream(packager.manifest.versionHash, 'cloneUpstream', {}),
  ).rejects.toThrowError('input');

  await expect(
    client.stream(packager.manifest.versionHash, 'cloneUpstream', {
      field: 'str',
      nested: { field2: true },
    }),
  ).resolves.toEqual([{ success: true, affiliateId: expect.any(String) }]);

  // can query the passthrough table
  await expect(
    client.query(packager.manifest.versionHash, 'select * from users', {}),
  ).resolves.toEqual({
    metadata: expect.any(Object),
    outputs: [{ name: 'me', birthdate: expect.any(Date) }],
    latestVersionHash: packager.manifest.versionHash,
  });
}, 45e3);
