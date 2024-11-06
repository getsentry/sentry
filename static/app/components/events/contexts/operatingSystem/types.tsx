// https://develop.sentry.dev/sdk/data-model/event-payloads/contexts/#os-context
export enum OperatingSystemKnownDataType {
  NAME = 'name',
  VERSION = 'version',
  BUILD = 'build',
  KERNEL_VERSION = 'kernel_version',
  ROOTED = 'rooted',
  THEME = 'theme',
  RAW_DESCRIPTION = 'raw_description',
  DISTRIBUTION = 'distribution',
}

export type OperatingSystemKnownData = {
  type?: string;
  [OperatingSystemKnownDataType.NAME]?: string;
  [OperatingSystemKnownDataType.VERSION]?: string;
  [OperatingSystemKnownDataType.BUILD]?: string;
  [OperatingSystemKnownDataType.KERNEL_VERSION]?: string;
  [OperatingSystemKnownDataType.ROOTED]?: boolean;
  [OperatingSystemKnownDataType.THEME]?: string;
  [OperatingSystemKnownDataType.RAW_DESCRIPTION]?: string;
  [OperatingSystemKnownDataType.DISTRIBUTION]?: {
    name?: string;
    pretty_name?: string;
    version?: string;
  };
};
