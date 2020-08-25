export enum RuntimeKnownDataType {
  NAME = 'name',
  VERSION = 'version',
}

export enum RuntimeIgnoredDataType {
  BUILD = 'build',
}

export type RuntimeData = {
  name: string;
  type: string;
  build: string;
  version?: string;
};
