export type RichHttpContentData = {
  data: Data;
};

export type Data = {
  headers: Array<[string, string]>;
  query: Array<[string, string] | null> | {[key: string]: any};
  env: {[key: string]: any} | null;
  fragment: string | null;
  cookies: Array<[string, string]>;
  data: SubData;
  inferredContentType: InferredContentType;
};

export type InferredContentType =
  | null
  | 'application/json'
  | 'application/x-www-form-urlencoded'
  | 'multipart/form-data';

export type SubData = string | null | {[key: string]: any} | Array<{[key: string]: any}>;
