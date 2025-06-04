export enum DebugFileType {
  EXE = 'exe',
  DBG = 'dbg',
  LIB = 'lib',
}

export enum DebugFileFeature {
  SYMTAB = 'symtab',
  DEBUG = 'debug',
  UNWIND = 'unwind',
  SOURCES = 'sources',
}

type Secret = {'hidden-secret': boolean};

export type BuiltinSymbolSource = {
  hidden: boolean;
  id: string;
  name: string;
  sentry_key: string;
};

export type DebugFile = {
  codeId: string;
  cpuName: string;
  dateCreated: string;
  debugId: string;
  headers: Record<string, string>;
  id: string;
  objectName: string;
  sha1: string;
  size: number;
  symbolType: string;
  uuid: string;
  data?: {features: DebugFileFeature[]; type: DebugFileType};
};

// Custom Repository
export enum CustomRepoType {
  HTTP = 'http',
  S3 = 's3',
  GCS = 'gcs',
}

export type CustomRepoHttp = {
  id: string;
  layout: {casing: string; type: string};
  name: string;
  password: Secret;
  type: CustomRepoType.HTTP;
  url: string;
  username: string;
};

type CustomRepoS3 = {
  access_key: string;
  bucket: string;
  id: string;
  layout: {casing: string; type: string};
  name: string;
  region: string;
  secret_key: Secret;
  type: CustomRepoType.S3;
};

type CustomRepoGCS = {
  bucket: string;
  client_email: string;
  id: string;
  layout: {casing: string; type: string};
  name: string;
  prefix: string;
  private_key: Secret;
  type: CustomRepoType.GCS;
};

export type CustomRepo = CustomRepoHttp | CustomRepoS3 | CustomRepoGCS;
