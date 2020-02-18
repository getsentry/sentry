import {t} from 'app/locale';

import {AppData, AppKnownDataType} from './types';

type Output = {
  subject: string;
  value: React.ReactNode | null;
};

function getAppKnownDataDetails(data: AppData, type: AppKnownDataType): Output {
  switch (type) {
    case AppKnownDataType.ID:
      return {
        subject: t('ID'),
        value: data.app_id || null,
      };
    case AppKnownDataType.START_TIME:
      return {
        subject: t('Start Time'),
        value: data.app_start_time || null,
      };
    case AppKnownDataType.DEVICE_HASH:
      return {
        subject: t('Device'),
        value: data.device_app_hash || null,
      };
    case AppKnownDataType.TYPE:
      return {
        subject: t('Build Type'),
        value: data.build_type || null,
      };
    case AppKnownDataType.IDENTIFIER:
      return {
        subject: t('Build ID'),
        value: data.app_identifier || null,
      };
    case AppKnownDataType.NAME:
      return {
        subject: t('Build Name'),
        value: data.app_name || null,
      };
    case AppKnownDataType.VERSION:
      return {
        subject: t('Version'),
        value: data.app_version || null,
      };
    case AppKnownDataType.BUILD:
      return {
        subject: t('App Build'),
        value: data.app_build || null,
      };
    default:
      return {
        subject: type,
        value: data[type] || null,
      };
  }
}

export default getAppKnownDataDetails;
