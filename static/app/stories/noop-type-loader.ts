import type {LoaderContext} from 'webpack';

export default function noopTypeLoader(this: LoaderContext<any>, _source: string) {
  const callback = this.async();
  return callback(null, 'export default {}');
}
