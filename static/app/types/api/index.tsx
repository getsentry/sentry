import {paths} from 'sentry/openapi';

export type ExtractPathResponseData<
  TPath extends keyof paths,
  TOperation extends keyof paths[TPath]
> = paths[TPath][TOperation] extends {
  responses: {200: {content: {'application/json': any}}};
}
  ? paths[TPath][TOperation]['responses'][200]['content']['application/json']
  : never;
