export enum AppKnownDataType {
  ID = 'app_id',
  START_TIME = 'app_start_time',
  DEVICE_HASH = 'device_app_hash',
  TYPE = 'build_type',
  IDENTIFIER = 'app_identifier',
  NAME = 'app_name',
  VERSION = 'app_version',
  BUILD = 'app_build',
}

export type AppData = {
  type: string;
  app_name?: string;
  app_version?: string;
  app_id?: string;
  app_start_time?: string;
  device_app_hash?: string;
  build_type?: string;
  app_identifier?: string;
  app_build?: string;
};
