import type {KnownDataDetails} from 'sentry/components/events/contexts/utils';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';

import type {OperatingSystemKnownData} from './types';
import {OperatingSystemKnownDataType} from './types';

type Props = {
  data: OperatingSystemKnownData;
  type: OperatingSystemKnownDataType;
};

export function getOperatingSystemKnownDataDetails({
  data,
  type,
}: Props): KnownDataDetails {
  switch (type) {
    case OperatingSystemKnownDataType.NAME:
      return {
        subject: t('Name'),
        value: data.name,
      };
    case OperatingSystemKnownDataType.VERSION:
      return {
        subject: t('Version'),
        value: data.version,
      };
    case OperatingSystemKnownDataType.BUILD:
      return {
        subject: t('Build'),
        value: data.build,
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
    case OperatingSystemKnownDataType.THEME:
      return {
        subject: t('Theme'),
        value: data.theme,
      };
    case OperatingSystemKnownDataType.RAW_DESCRIPTION:
      return {
        subject: t('Raw Description'),
        value: data.raw_description,
      };
    case OperatingSystemKnownDataType.DISTRIBUTION:
      return {
        subject: t('Distro'),
        value: data.distribution?.pretty_name
          ? data.distribution?.pretty_name
          : `${data.distribution?.name}${data.distribution?.version ? `(${data.distribution.version})` : ''}`,
      };
    default:
      return undefined;
  }
}
