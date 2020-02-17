export enum OperatingSystemKnownDataType {
  NAME = 'name',
  VERSION = 'version',
  KERNEL_VERSION = 'kernel_version',
  ROOTED = 'rooted',
}

export type OperatingSystemKnownData = {
  name: string;
  type: string;
  build: string;
  kernel_version: string;
  version?: string;
  rooted?: boolean;
};
