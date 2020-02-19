export enum RuntimeKnownDataType {
  NAME = 'name',
  VERSION = 'version',
}

export type RuntimeData = {
  name: string;
  type: string;
  build: string;
  version?: string;
};
