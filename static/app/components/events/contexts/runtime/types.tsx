export enum RuntimeKnownDataType {
  NAME = 'name',
  VERSION = 'version',
  BUILD = 'build',
  RAW_DESCRIPTION = 'raw_description',
}

export type RuntimeData = {
  type: string;
  [RuntimeKnownDataType.NAME]: string;
  [RuntimeKnownDataType.VERSION]?: string;
  [RuntimeKnownDataType.BUILD]?: string;
  [RuntimeKnownDataType.RAW_DESCRIPTION]?: string;
};
