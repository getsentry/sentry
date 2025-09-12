import type {KnownApiUrls} from './knownUrls';
import type {paths} from './openapi';

type SnakeToCamel<S extends string> = S extends `${infer Head}_${infer Tail}`
  ? `${Head}${Capitalize<SnakeToCamel<Tail>>}`
  : S;

// replace {param_name} → $paramName
type ParamToDollarCamel<S extends string> = S extends `{${infer Param}}`
  ? `$${SnakeToCamel<Param>}`
  : S;

// Recursive: split by '/', transform params, join back
type TransformSegments<S extends string> = S extends `/${infer Rest}`
  ? `/${TransformSegments<Rest>}`
  : S extends `${infer Segment}/${infer Tail}`
    ? `${ParamToDollarCamel<Segment>}/${TransformSegments<Tail>}`
    : ParamToDollarCamel<S>;

// filter GET paths, strip `/api/0`, and transform params
type GetPaths = {
  [P in keyof paths]: 'get' extends keyof paths[P]
    ? P extends `/api/0${infer Rest}`
      ? TransformSegments<Rest>
      : never
    : never;
}[keyof paths];

export type ApiPath = GetPaths | (string & {});
