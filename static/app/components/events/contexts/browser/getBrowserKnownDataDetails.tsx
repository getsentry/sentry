import type {KnownDataDetails} from 'sentry/components/events/contexts/utils';
import {t} from 'sentry/locale';

import type {BrowserKnownData} from './types';
import {BrowserKnownDataType} from './types';

type Props = {
  data: BrowserKnownData;
  type: BrowserKnownDataType;
};

export function getBrowserKnownDataDetails({data, type}: Props): KnownDataDetails {
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
