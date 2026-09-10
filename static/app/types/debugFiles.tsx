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

type CustomRepoMetadata = {
  filters?: {
    filetypes?: string[];
    path_patterns?: string[];
    requires_checksum?: boolean;
  };
  has_index?: boolean;
  is_public?: boolean;
  platforms?: string[];
};

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

export type CustomRepoHttp = CustomRepoMetadata & {
  id: string;
  layout: {casing: string; type: string};
  name: string;
  type: CustomRepoType.HTTP;
  url: string;
  password?: Secret;
  username?: string;
};

export type CustomRepoS3 = CustomRepoMetadata & {
  access_key: string;
  bucket: string;
  id: string;
  layout: {casing: string; type: string};
  name: string;
  region: string;
  type: CustomRepoType.S3;
  prefix?: string;
  secret_key?: Secret;
};

export type CustomRepoGCS = CustomRepoMetadata & {
  bucket: string;
  client_email: string;
  id: string;
  layout: {casing: string; type: string};
  name: string;
  type: CustomRepoType.GCS;
  prefix?: string;
  private_key?: Secret;
};

export type CustomRepo = CustomRepoHttp | CustomRepoS3 | CustomRepoGCS;

type FlattenedLayout = {
  'layout.casing': string;
  'layout.type': string;
};

export type CustomRepoFormData =
  | (Omit<CustomRepoHttp, 'layout' | 'password'> &
      FlattenedLayout & {password?: Secret | string})
  | (Omit<CustomRepoS3, 'layout' | 'secret_key'> &
      FlattenedLayout & {secret_key?: Secret | string})
  | (Omit<CustomRepoGCS, 'layout' | 'private_key'> &
      FlattenedLayout & {private_key?: Secret | string});
