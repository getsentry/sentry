import {ValidationErrorDetailed} from 'app/components/modals/debugFileCustomRepository/appStoreConnect/utils';

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
  data?: {type: DebugFileType; features: DebugFileFeature[]};
};

// Custom Repositories
export enum CustomRepoType {
  HTTP = 'http',
  S3 = 's3',
  GCS = 'gcs',
  APP_STORE_CONNECT = 'appStoreConnect',
}

export type AppStoreConnectCredentialsStatus =
  | {status: 'valid'}
  | ({status: 'invalid'} & ValidationErrorDetailed);

export type AppStoreConnectValidationData = {
  id: string;
  credentials: AppStoreConnectCredentialsStatus;
  /**
   * Indicates the number of downloads waiting to be processed and completed,
   * or the number of downloads waiting for valid credentials to be completed if applicable.
   */
  pendingDownloads: number;
  /**
   * The build number of the latest build recognized by sentry. This does not
   * imply the dSYMs for this build have been fetched. The contents of this
   * string is just a number. This will be null if no builds can be found.
   */
  latestBuildNumber: string | null;
  /**
   * A human-readable string representing the latest build recognized by
   * sentry. i.e. 3.4.0. This does not imply the dSYMs for this build have been
   * fetched. This will be null if no builds can be found.
   */
  latestBuildVersion: string | null;
  lastCheckedBuilds: string | null;
  updateAlertMessage?: string;
};

type CustomRepoAppStoreConnect = {
  type: CustomRepoType.APP_STORE_CONNECT;
  appId: string;
  appName: string;
  appconnectIssuer: string;
  appconnectKey: string;
  appconnectPrivateKey: string;
  bundleId: string;
  id: string;
  name: string;
  details?: AppStoreConnectValidationData;
};

type CustomRepoHttp = {
  type: CustomRepoType.HTTP;
  id: string;
  layout: {casing: string; type: string};
  name: string;
  url: string;
};

type CustomRepoS3 = {
  type: CustomRepoType.S3;
  access_key: string;
  bucket: string;
  id: string;
  layout: {type: string; casing: string};
  name: string;
  region: string;
  secret_key: string;
};

type CustomRepoGCS = {
  type: CustomRepoType.GCS;
  bucket: string;
  client_email: string;
  id: string;
  layout: {type: string; casing: string};
  name: string;
  prefix: string;
  private_key: string;
};

export type CustomRepo =
  | CustomRepoAppStoreConnect
  | CustomRepoHttp
  | CustomRepoS3
  | CustomRepoGCS;
