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

export type AppStoreConnectValidationData = {
  id: string;
  appstoreCredentialsValid: boolean;
  itunesSessionValid: boolean;
  /** Approximate expiration Date of AppStore Connect iTunes session as an ISO DateTime */
  itunesSessionRefreshAt: string | null;
  /** Indicates if the itunesSession is actually *needed* to complete any downloads that are pending. */
  pendingDownloads: number;
  /**
   * The build number of the latest build recognized by sentry. This does not imply the dSYMs for
   * this build have been fetched. The contents of this string is just a number. This will be null
   * if no builds can be found.
   */
  latestBuildNumber: string | null;
  /**
   * A human-readable string representing the latest build recognized by sentry. i.e. 3.4.0. This
   * does not imply the dSYMs for this build have been fetched. This will be null if no builds can
   * be found.
   */
  latestBuildVersion: string | null;
  updateAlertMessage?: string;
};
