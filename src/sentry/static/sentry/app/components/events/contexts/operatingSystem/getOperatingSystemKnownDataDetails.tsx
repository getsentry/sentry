import {t} from 'app/locale';
import {defined} from 'app/utils';

import {OperatingSystemKnownData, OperatingSystemKnownDataType} from './types';

type Output = {
  subject: string;
  value: React.ReactNode | null;
};

function getOperatingSystemKnownDataDetails(
  data: OperatingSystemKnownData,
  type: OperatingSystemKnownDataType
): Output {
  switch (type) {
    case OperatingSystemKnownDataType.NAME:
      return {
        subject: t('Name'),
        value: data.name,
      };
    case OperatingSystemKnownDataType.VERSION:
      return {
        subject: t('Version'),
        value: `${data.version}${data.build ? `(${data.build})` : ''}`,
      };
    case OperatingSystemKnownDataType.KERNEL_VERSION:
      return {
        subject: t('Kernel Version'),
        value: data.kernel_version,
      };
    case OperatingSystemKnownDataType.ROOTED:
      return {
        subject: t('Rooted'),
        value: defined(data.rooted) ? (data.rooted ? 'yes' : 'no') : null,
      };
    default:
      return {
        subject: type,
        value: data[type] || null,
      };
  }
}

export default getOperatingSystemKnownDataDetails;
