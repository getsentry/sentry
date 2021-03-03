import {t} from 'app/locale';

import {AppData, AppKnownDataType} from './types';

type Output = {
  subject: string;
  value?: React.ReactNode;
};

function getAppKnownDataDetails(data: AppData, type: AppKnownDataType): Output {
  switch (type) {
    case AppKnownDataType.ID:
      return {
        subject: t('ID'),
        value: data.app_id,
      };
    case AppKnownDataType.START_TIME:
      return {
        subject: t('Start Time'),
        value: data.app_start_time,
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
    default:
      return {
        subject: type,
        value: data[type],
      };
  }
}

export default getAppKnownDataDetails;
