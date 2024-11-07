export enum AppKnownDataType {
  ID = 'app_id',
  START_TIME = 'app_start_time',
  DEVICE_HASH = 'device_app_hash',
  TYPE = 'build_type',
  IDENTIFIER = 'app_identifier',
  NAME = 'app_name',
  VERSION = 'app_version',
  BUILD = 'app_build',
  IN_FOREGROUND = 'in_foreground',
  MEMORY = 'app_memory',
  VIEW_NAMES = 'view_names',
}

export type AppData = {
  type: string;
  [AppKnownDataType.BUILD]?: string;
  [AppKnownDataType.ID]?: string;
  [AppKnownDataType.IDENTIFIER]?: string;
  [AppKnownDataType.NAME]?: string;
  [AppKnownDataType.START_TIME]?: string;
  [AppKnownDataType.VERSION]?: string;
  [AppKnownDataType.TYPE]?: string;
  [AppKnownDataType.DEVICE_HASH]?: string;
  [AppKnownDataType.IN_FOREGROUND]?: boolean;
  [AppKnownDataType.MEMORY]?: number;
  [AppKnownDataType.VIEW_NAMES]?: string[];
};
