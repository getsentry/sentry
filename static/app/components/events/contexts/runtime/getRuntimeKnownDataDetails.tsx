import type {KnownDataDetails} from 'sentry/components/events/contexts/utils';
import {t} from 'sentry/locale';

import type {RuntimeData} from './types';
import {RuntimeKnownDataType} from './types';

type Props = {
  data: RuntimeData;
  type: RuntimeKnownDataType;
};

export function getRuntimeKnownDataDetails({type, data}: Props): KnownDataDetails {
  switch (type) {
    case RuntimeKnownDataType.NAME:
      return {
        subject: t('Name'),
        value: data.name,
      };
    case RuntimeKnownDataType.VERSION:
      return {
        subject: t('Version'),
        value: `${data.version}${data.build ? `(${data.build})` : ''}`,
      };
    default:
      return undefined;
  }
}
