import * as docgen from 'react-docgen-typescript';
import type {LoaderContext} from 'webpack';

export default function typeLoader(this: LoaderContext<any>, _source: string) {
  const callback = this.async();
  const entries = docgen.parse(this.resourcePath);

  if (!entries) {
    return callback(null, 'export default {}');
  }

  return callback(null, `export default ${JSON.stringify(entries)}`);
}
