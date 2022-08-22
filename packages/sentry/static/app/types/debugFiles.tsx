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
  APP_STORE_CONNECT = 'appStoreConnect',
}

export type AppStoreConnectValidationError = {
  code:
    | 'app-connect-authentication-error'
    | 'app-connect-forbidden-error'
    | 'app-connect-multiple-sources-error';
};

interface ValidAppStoreConnectCredentialsStatus {
  status: 'valid';
}

interface InvalidAppStoreConnectCredentialsStatus extends AppStoreConnectValidationError {
  status: 'invalid';
}

export type AppStoreConnectCredentialsStatus =
  | ValidAppStoreConnectCredentialsStatus
  | InvalidAppStoreConnectCredentialsStatus;

export type AppStoreConnectStatusData = {
  credentials: AppStoreConnectCredentialsStatus;
  lastCheckedBuilds: string | null;
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
  /**
   * Indicates the number of downloads waiting to be processed and completed,
   * or the number of downloads waiting for valid credentials to be completed if applicable.
   */
  pendingDownloads: number;
  updateAlertMessage?: string;
};

export type CustomRepoAppStoreConnect = {
  appId: string;
  appName: string;
  appconnectIssuer: string;
  appconnectKey: string;
  appconnectPrivateKey: Secret;
  bundleId: string;
  id: string;
  name: string;
  type: CustomRepoType.APP_STORE_CONNECT;
  details?: AppStoreConnectStatusData;
};

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

export type CustomRepo =
  | CustomRepoAppStoreConnect
  | CustomRepoHttp
  | CustomRepoS3
  | CustomRepoGCS;
