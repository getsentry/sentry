import type {LoaderContext} from 'webpack';

// Use async to mimick the type-loader behavior
// eslint-disable-next-line require-await
export default async function noopTypeLoader(this: LoaderContext<any>, _source: string) {
  const callback = this.async();
  return callback(null, 'export default {}');
}
