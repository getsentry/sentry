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
    case RuntimeKnownDataType.BUILD:
      return {
        subject: t('Build'),
        value: data.build,
      };
    case RuntimeKnownDataType.VERSION:
      return {
        subject: t('Version'),
        value: data.version,
      };
    case RuntimeKnownDataType.RAW_DESCRIPTION:
      return {
        subject: t('Raw Description'),
        value: data.raw_description,
      };
    default:
      return undefined;
  }
}
