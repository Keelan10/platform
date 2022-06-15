import IDataboxRunOptions from './IDataboxRunOptions';

export default interface IDataboxWrapper<TOutput = any> {
  run(options?: IDataboxRunOptions): Promise<TOutput>;
}

export interface IDataboxWrapperClass {
  module: string;
  defaultExport: IDataboxWrapper;
}