import {t} from 'app/locale';
import {defined} from 'app/utils';

export enum OperatingSystemKnownDataDetailsType {
  NAME = 'name',
  VERSION = 'version',
  KERNEL_VERSION = 'kernel_version',
  ROOTED = 'rooted',
}

export type OperatingSystemData = {
  name: string;
  type: string;
  build: string;
  kernel_version: string;
  version?: string;
  rooted?: boolean;
};

type Output = {
  subject: string;
  value: string | null;
};

function getOperatingSystemKnownDataDetails(
  data: OperatingSystemData,
  type: OperatingSystemKnownDataDetailsType
): Output | undefined {
  switch (type) {
    case OperatingSystemKnownDataDetailsType.NAME:
      return {
        subject: t('Name'),
        value: data.name,
      };
    case OperatingSystemKnownDataDetailsType.VERSION:
      return {
        subject: t('Version'),
        value: `${data.version}${data.build ? `(${data.build})` : ''}`,
      };
    case OperatingSystemKnownDataDetailsType.KERNEL_VERSION:
      return {
        subject: t('Kernel Version'),
        value: data.kernel_version,
      };
    case OperatingSystemKnownDataDetailsType.ROOTED:
      return {
        subject: t('Rooted'),
        value: defined(data.rooted) ? (data.rooted ? 'yes' : 'no') : null,
      };
    default:
      return undefined;
  }
}

export default getOperatingSystemKnownDataDetails;
