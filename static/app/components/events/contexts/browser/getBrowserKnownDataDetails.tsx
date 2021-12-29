import {t} from 'sentry/locale';

import {BrowserKnownData, BrowserKnownDataType} from './types';

type Output = {
  subject: string;
  value: React.ReactNode | null;
};

function getOperatingSystemKnownDataDetails(
  data: BrowserKnownData,
  type: BrowserKnownDataType
): Output {
  switch (type) {
    case BrowserKnownDataType.NAME:
      return {
        subject: t('Name'),
        value: data.name,
      };
    case BrowserKnownDataType.VERSION:
      return {
        subject: t('Version'),
        value: `${data.version}`,
      };
    default:
      return {
        subject: type,
        value: data[type] || null,
      };
  }
}

export default getOperatingSystemKnownDataDetails;
