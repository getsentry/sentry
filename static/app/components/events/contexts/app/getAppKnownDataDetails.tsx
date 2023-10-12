import {t} from 'sentry/locale';
import {Event} from 'sentry/types/event';

import {getRelativeTimeFromEventDateCreated} from '../utils';

import {AppData, AppKnownDataType} from './types';

type Output = {
  subject: string;
  value?: React.ReactNode;
};

type Props = {
  data: AppData;
  event: Event;
  type: AppKnownDataType;
};

export function getAppKnownDataDetails({data, event, type}: Props): Output | undefined {
  switch (type) {
    case AppKnownDataType.ID:
      return {
        subject: t('ID'),
        value: data.app_id,
      };
    case AppKnownDataType.START_TIME:
      return {
        subject: t('Start Time'),
        value: getRelativeTimeFromEventDateCreated(
          event.dateCreated ? event.dateCreated : event.dateReceived,
          data.app_start_time
        ),
      };
    case AppKnownDataType.DEVICE_HASH:
      return {
        subject: t('Device'),
        value: data.device_app_hash,
      };
    case AppKnownDataType.TYPE:
      return {
        subject: t('Build Type'),
        value: data.build_type,
      };
    case AppKnownDataType.IDENTIFIER:
      return {
        subject: t('Build ID'),
        value: data.app_identifier,
      };
    case AppKnownDataType.NAME:
      return {
        subject: t('Build Name'),
        value: data.app_name,
      };
    case AppKnownDataType.VERSION:
      return {
        subject: t('Version'),
        value: data.app_version,
      };
    case AppKnownDataType.BUILD:
      return {
        subject: t('App Build'),
        value: data.app_build,
      };
    case AppKnownDataType.IN_FOREGROUND:
      return {
        subject: t('In Foreground'),
        value: data.in_foreground,
      };
    default:
      return undefined;
  }
}
