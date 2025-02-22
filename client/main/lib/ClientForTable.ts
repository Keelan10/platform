import { ConnectionToDatastoreCore, Table } from '@ulixee/datastore';
import { IOutputSchema } from '../interfaces/IInputOutput';

export default class ClientForTable<TTable extends Table> {
  private table: TTable;

  constructor(table: TTable, options?: { connectionToCore: ConnectionToDatastoreCore }) {
    this.table = table;
    if (options?.connectionToCore) table.addConnectionToDatastoreCore(options?.connectionToCore);
  }

  public fetch(inputFilter: Partial<TTable['schemaType']>): Promise<TTable['schemaType'][]> {
    return this.table.fetchInternal({ input: inputFilter });
  }

  public run(inputFilter?: Partial<TTable['schemaType']>): Promise<TTable['schemaType'][]> {
    return this.fetch(inputFilter);
  }

  public query<TOutputSchema extends IOutputSchema = IOutputSchema>(
    sql: string,
    boundValues: any[] = [],
  ): Promise<TOutputSchema[]> {
    return this.table.queryInternal(sql, boundValues);
  }
}
