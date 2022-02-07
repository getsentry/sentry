export enum OperatingSystemKnownDataType {
  NAME = 'name',
  VERSION = 'version',
  KERNEL_VERSION = 'kernel_version',
  ROOTED = 'rooted',
}

export enum OperatingSystemIgnoredDataType {
  BUILD = 'build',
}

export type OperatingSystemKnownData = {
  build: string;
  kernel_version: string;
  name: string;
  type: string;
  rooted?: boolean;
  version?: string;
};
