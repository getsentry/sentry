type ExtractPathParams<TApiPath extends string> =
  TApiPath extends `${string}$${infer Param}/${infer Rest}`
    ? Param | ExtractPathParams<`/${Rest}`>
    : TApiPath extends `${string}$${infer Param}`
      ? Param
      : never;

type PathParamOptions<TApiPath extends string> =
  ExtractPathParams<TApiPath> extends never
    ? {path?: never}
    : {path: Record<ExtractPathParams<TApiPath>, string | number>};

type OptionalPathParams<TApiPath extends string> =
  ExtractPathParams<TApiPath> extends never
    ? [] // eslint-disable-line @typescript-eslint/no-restricted-types
    : [PathParamOptions<TApiPath>];

const paramRegex = /\$([a-zA-Z0-9_-]+)/g;

type ApiUrl = string & {__apiUrl: true};

export function getApiUrl<TApiPath extends string>(
  path: TApiPath,
  ...[options]: OptionalPathParams<TApiPath>
): ApiUrl {
  let url: string = path;
  const pathParams = options?.path;
  if (pathParams) {
    // Replace path parameters in the URL with their corresponding values
    url = url.replace(paramRegex, (_, key: string) => {
      if (!(key in pathParams)) {
        throw new Error(`Missing path param: ${key}`);
      }
      return encodeURIComponent(String(pathParams[key as keyof typeof pathParams]));
    });
  }
  return url as ApiUrl;
}
