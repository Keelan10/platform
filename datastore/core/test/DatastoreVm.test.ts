import { mkdirSync, rmSync } from 'fs';
import * as Path from 'path';
import Packager from '@ulixee/datastore-packager';
import DatastoreApiClient from '@ulixee/datastore/lib/DatastoreApiClient';
import UlixeeMiner from '@ulixee/miner';
import * as Moment from 'moment';
import DatastoreCore from '../index';

const storageDir = Path.resolve(process.env.ULX_DATA_DIR ?? '.', 'DatastoreVm.test');
const tmpDir = `${storageDir}/tmp`;
let miner: UlixeeMiner;
let client: DatastoreApiClient;

beforeAll(async () => {
  mkdirSync(storageDir, { recursive: true });
  DatastoreCore.options.datastoresTmpDir = tmpDir;
  DatastoreCore.options.datastoresDir = storageDir;
  miner = new UlixeeMiner();
  miner.router.datastoreConfiguration = { datastoresDir: storageDir };
  await miner.listen();
  client = new DatastoreApiClient(await miner.address);
}, 30e3);

afterAll(async () => {
  await miner.close();
  await client.disconnect();
  try {
    rmSync(storageDir, { recursive: true });
  } catch (err) {}
});

test('can run a Datastore with momentjs', async () => {
  const packager = new Packager(require.resolve('./datastores/moment.ts'));
  const dbx = await packager.build();
  await dbx.upload(await miner.address);
  await expect(
    client.stream(packager.manifest.versionHash, 'moment', { date: '2021/02/01' }),
  ).rejects.toThrow('input did not match its Schema');

  await expect(
    client.stream(packager.manifest.versionHash, 'moment', { date: '2021-02-01' }),
  ).resolves.toEqual([{ date: Moment('2021-02-01').toDate() }]);
}, 45e3);

test('can get the stack trace of a compiled datastore', async () => {
  const packager = new Packager(require.resolve('./datastores/errorStackDatastore.ts'));
  const dbx = await packager.build();
  await dbx.upload(await miner.address);
  const expectedPath = Path.join(
    `errorStackDatastore@${packager.manifest.versionHash}.dbx`,
    'datastore',
    'core',
    'test',
    'datastores',
    'errorStack.ts',
  );
  try {
    await client.stream(packager.manifest.versionHash, 'errorStack', {});
  } catch (error) {
    expect(error.stack).toContain(`at multiply (${expectedPath}:15:25)`);
  }
}, 45e3);
