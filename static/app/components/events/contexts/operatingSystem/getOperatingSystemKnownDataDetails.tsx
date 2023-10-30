import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';

import {OperatingSystemKnownData, OperatingSystemKnownDataType} from './types';

type Output = {
  subject: string;
  value: React.ReactNode | null;
};

type Props = {
  data: OperatingSystemKnownData;
  type: OperatingSystemKnownDataType;
};

export function getOperatingSystemKnownDataDetails({
  data,
  type,
}: Props): Output | undefined {
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
        value: defined(data.rooted) ? (data.rooted ? t('yes') : t('no')) : null,
      };
    default:
      return undefined;
  }
}
