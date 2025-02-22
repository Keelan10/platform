import * as Fs from 'fs';
import * as Path from 'path';
import UlixeeMiner from '@ulixee/miner';
import { ConnectionToDatastoreCore } from '@ulixee/datastore';
import Client from '..';
import localTable from './datastores/localTable';

const storageDir = Path.resolve(process.env.ULX_DATA_DIR ?? '.', 'Client.localTable.test');
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
  const client = Client.forTable(localTable, { connectionToCore });
  const results = await client.query('SELECT * FROM self');

  expect(results).toEqual([
    {
      firstName: 'Caleb',
      lastName: 'Clark',
      birthdate: expect.any(Date),
      commits: null,
    },
    {
      firstName: 'Blake',
      lastName: 'Byrnes',
      commits: 1n,
      birthdate: null,
    },
  ]);
});

test('should be able to fetch from a table', async () => {
  const client = Client.forTable(localTable, { connectionToCore });
  const results = await client.fetch({ firstName: 'Caleb' });

  expect(results).toEqual([
    {
      firstName: 'Caleb',
      lastName: 'Clark',
      birthdate: expect.any(Date),
      commits: null,
    },
  ]);

  // @ts-expect-error -- invalid column
  await expect(client.fetch({ lastSeenDate: '08/01/90' })).rejects.toThrowError();
});
