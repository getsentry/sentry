import {t} from 'app/locale';

export enum AppKnownDataDetailsType {
  ID = 'app_id',
  START_TIME = 'app_start_time',
  DEVICE_HASH = 'device_app_hash',
  TYPE = 'build_type',
  IDENTIFIER = 'app_identifier',
  NAME = 'app_name',
  VERSION = 'app_version',
  BUILD = 'app_build',
}

export type AppData = {
  type: string;
  app_name?: string;
  app_version?: string;
  app_id?: string;
  app_start_time?: string;
  device_app_hash?: string;
  build_type?: string;
  app_identifier?: string;
  app_build?: string;
};

type Output = {
  subject: string;
  value: string | null;
};

function getAppKnownDataDetails(
  data: AppData,
  type: AppKnownDataDetailsType
): Output | undefined {
  switch (type) {
    case AppKnownDataDetailsType.ID:
      return {
        subject: t('ID'),
        value: data.app_id || null,
      };
    case AppKnownDataDetailsType.START_TIME:
      return {
        subject: t('Start Time'),
        value: data.app_start_time || null,
      };
    case AppKnownDataDetailsType.DEVICE_HASH:
      return {
        subject: t('Device'),
        value: data.device_app_hash || null,
      };
    case AppKnownDataDetailsType.TYPE:
      return {
        subject: t('Build Type'),
        value: data.build_type || null,
      };
    case AppKnownDataDetailsType.IDENTIFIER:
      return {
        subject: t('Build ID'),
        value: data.app_identifier || null,
      };
    case AppKnownDataDetailsType.NAME:
      return {
        subject: t('Build Name'),
        value: data.app_name || null,
      };
    case AppKnownDataDetailsType.VERSION:
      return {
        subject: t('Version'),
        value: data.app_version || null,
      };
    case AppKnownDataDetailsType.BUILD:
      return {
        subject: t('App Build'),
        value: data.app_build || null,
      };
    default:
      return undefined;
  }
}

export default getAppKnownDataDetails;
