import * as Fs from 'fs';
import { encodeBuffer } from '@ulixee/commons/lib/bufferUtils';
import { sha256 } from '@ulixee/commons/lib/hashUtils';
import installDatastoreSchema, { addDatastoreAlias } from '../types/installDatastoreSchema';

beforeEach(() => {
  Fs.writeFileSync(
    `${__dirname}/../types/index.d.ts`,
    `import IItemInputOutput from '@ulixee/datastore/interfaces/IItemInputOutput';
export default interface ITypes extends Record<string, IItemInputOutput> {}`,
  );
});

it('can install a schema', async () => {
  const schema = `{
    input: {
      var1: string;
    };
    output: {
      test2?: string;
    };
  }`;
  installDatastoreSchema(schema, 'thisIsATest');

  expect(Fs.existsSync(`${__dirname}/../types/thisIsATest.d.ts`)).toBe(true);
  expect(Fs.readFileSync(`${__dirname}/../types/index.d.ts`, 'utf8'))
    .toBe(`import IItemInputOutput from '@ulixee/datastore/interfaces/IItemInputOutput';
import thisIsATest from './thisIsATest';
export default interface ITypes extends Record<string, IItemInputOutput> {
  "thisIsATest": thisIsATest;
}`);
});

it('can install multiple schemas', async () => {
  const schema1 = `{
    input: {
      var1: string;
    };
    output: {
      test2?: string;
    };
  }`;
  const schema2 = `{
    input: {
      vars: string;
    };
    output: {
      nothing: boolean;
    };
  }`;
  const id1 = encodeBuffer(sha256('schema1'), 'dbx').substring(0,22);
  const id2 = encodeBuffer(sha256('schema2'), 'dbx').substring(0,22);;
  installDatastoreSchema(schema1, id1);
  installDatastoreSchema(schema2, id2);

  expect(Fs.existsSync(`${__dirname}/../types/${id1}.d.ts`)).toBe(true);
  expect(Fs.existsSync(`${__dirname}/../types/${id2}.d.ts`)).toBe(true);
  expect(Fs.readFileSync(`${__dirname}/../types/index.d.ts`, 'utf8'))
    .toBe(`import IItemInputOutput from '@ulixee/datastore/interfaces/IItemInputOutput';
import ${id1} from './${id1}';
import ${id2} from './${id2}';
export default interface ITypes extends Record<string, IItemInputOutput> {
  "${id1}": ${id1};
  "${id2}": ${id2};
}`);

  // test an alias
  addDatastoreAlias(id2, 'short2');
  expect(Fs.readFileSync(`${__dirname}/../types/index.d.ts`, 'utf8'))
    .toBe(`import IItemInputOutput from '@ulixee/datastore/interfaces/IItemInputOutput';
import ${id1} from './${id1}';
import ${id2} from './${id2}';
export default interface ITypes extends Record<string, IItemInputOutput> {
  "${id1}": ${id1};
  "${id2}": ${id2};
  "short2": ${id2};
}`);

  // test overwriting a value
  addDatastoreAlias(id1, 'short2');
  expect(Fs.readFileSync(`${__dirname}/../types/index.d.ts`, 'utf8'))
    .toBe(`import IItemInputOutput from '@ulixee/datastore/interfaces/IItemInputOutput';
import ${id1} from './${id1}';
import ${id2} from './${id2}';
export default interface ITypes extends Record<string, IItemInputOutput> {
  "${id1}": ${id1};
  "${id2}": ${id2};
  "short2": ${id1};
}`);
});
