import {t} from 'sentry/locale';

import {BrowserKnownData, BrowserKnownDataType} from './types';

type Output = {
  subject: string;
  value: React.ReactNode | null;
};

type Props = {
  data: BrowserKnownData;
  type: BrowserKnownDataType;
};

export function getBrowserKnownDataDetails({data, type}: Props): Output | undefined {
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
      return undefined;
  }
}
