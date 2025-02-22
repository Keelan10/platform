import * as Fs from 'fs';
import * as Path from 'path';
import UlixeeMiner from '@ulixee/miner';
import { ConnectionToDatastoreCore } from '@ulixee/datastore';
import Client from '..';
import localRunner from './datastores/localRunner';

const storageDir = Path.resolve(process.env.ULX_DATA_DIR ?? '.', 'Client.localRunner.test');
let miner: UlixeeMiner;
let connectionToCore: ConnectionToDatastoreCore;

beforeAll(async () => {
  miner = new UlixeeMiner();
  miner.router.datastoreConfiguration = {
    datastoresDir: storageDir,
    datastoresTmpDir: Path.join(storageDir, 'tmp'),
  };
  await miner.listen();
  connectionToCore = ConnectionToDatastoreCore.remote(await miner.address);
});

afterAll(async () => {
  await miner.close();
  await connectionToCore.disconnect();
  if (Fs.existsSync(storageDir)) Fs.rmSync(storageDir, { recursive: true });
});

test('should be able to query a datastore using sql', async () => {
  const client = Client.forRunner(localRunner, { connectionToCore });
  const results = await client.query('SELECT * FROM test(shouldTest => $1)', [true]);

  expect(results).toEqual([
    {
      testerEcho: true,
      lastName: 'Clark',
      greeting: 'Hello world',
    },
  ]);
});

test('should be able to run a datastore function', async () => {
  const client = Client.forRunner(localRunner, { connectionToCore });

  const testTypes = () => {
    // @ts-expect-error
    void client.run({ notValid: 1 });
  };

  const results = await client.run({ shouldTest: true });

  expect(results).toEqual([
    {
      testerEcho: true,
      lastName: 'Clark',
      greeting: 'Hello world',
    },
  ]);

  // @ts-expect-error - Test typing works
  const test: number = results[0].testerEcho;
  expect(test).not.toBe(expect.any(Number));

  // @ts-expect-error
  const first = results[0].firstName;
  expect(first).toBeUndefined();
});
