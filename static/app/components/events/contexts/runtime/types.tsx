export enum RuntimeKnownDataType {
  NAME = 'name',
  VERSION = 'version',
}

export enum RuntimeIgnoredDataType {
  BUILD = 'build',
}

export type RuntimeData = {
  build: string;
  name: string;
  type: string;
  version?: string;
};
