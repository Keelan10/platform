import * as Tar from 'tar';
import { PassThrough } from 'stream';

export function unpackDbx(compressedDatastore: Buffer, toDirectory: string): Promise<void> {
  const dbxStream = new PassThrough().end(compressedDatastore);
  return new Promise(resolve => {
    dbxStream
      .pipe(
        Tar.extract({
          cwd: toDirectory,
          preserveOwner: false,
        }),
      )
      .on('finish', resolve);
  });
}

export async function unpackDbxFile(
  file: string,
  toDirectory: string,
): Promise<void> {
  await Tar.extract({
    file,
    cwd: toDirectory,
    preserveOwner: false,
  });
}
