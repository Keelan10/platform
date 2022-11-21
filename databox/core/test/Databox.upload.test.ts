import * as Fs from 'fs';
import * as Path from 'path';
import DataboxPackager from '@ulixee/databox-packager';
import UlixeeMiner from '@ulixee/miner';
import IDataboxManifest from '@ulixee/specification/types/IDataboxManifest';
import Identity from '@ulixee/crypto/lib/Identity';
import DataboxApiClient from '@ulixee/databox/lib/DataboxApiClient';
import UlixeeHostsConfig from '@ulixee/commons/config/hosts';
import DataboxCore from '../index';

const storageDir = Path.resolve(process.env.ULX_DATA_DIR ?? '.', 'Databox.upload.test');

let dbxFile: Buffer;
let manifest: IDataboxManifest;
let miner: UlixeeMiner;
let client: DataboxApiClient;

beforeAll(async () => {
  jest.spyOn<any, any>(UlixeeHostsConfig.global, 'save').mockImplementation(() => null);
  const packager = new DataboxPackager(`${__dirname}/databoxes/upload.js`);
  await packager.build();
  dbxFile = await packager.dbx.asBuffer();
  manifest = packager.manifest.toJSON();
  miner = new UlixeeMiner();
  miner.router.databoxConfiguration = { databoxesDir: storageDir };
  await miner.listen();
  client = new DataboxApiClient(await miner.address);
});

afterAll(async () => {
  Fs.rmdirSync(storageDir, { recursive: true });
  await miner.close();
});

test('should be able upload a databox', async () => {
  await client.upload(dbxFile);
  expect(Fs.existsSync(storageDir)).toBeTruthy();
  expect(manifest.schemaInterface).toBe(`{
  upTest: {
    output: {
      /**
       * Whether or not this test succeeded
       */
      upload: boolean;
    };
  };
}`)
  expect(Fs.existsSync(`${storageDir}/upload@${manifest.versionHash}.dbx`)).toBeTruthy();
});

test('should be able to restrict uploads', async () => {
  const identity = await Identity.create();
  DataboxCore.options.uploaderIdentities = [identity.bech32];

  await expect(client.upload(dbxFile)).rejects.toThrowError(
    'Identity is not approved',
  );
  await expect(client.upload(dbxFile, { identity })).resolves.toBeTruthy();
});
