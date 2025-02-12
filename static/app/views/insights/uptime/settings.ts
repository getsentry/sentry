import {t} from 'sentry/locale';

export const MODULE_TITLE = t('Uptime Monitors');
export const MODULE_SIDEBAR_TITLE = t('Uptime');
export const DATA_TYPE = t('Uptime Check');
export const DATA_TYPE_PLURAL = t('Uptime Checks');
export const BASE_URL = 'uptime';

export const MODULE_DESCRIPTION = t(
  'Uptime monitors continuously track configured URLs, delivering alerts and insights to quickly identify downtime and troubleshoot issues.'
);
export const MODULE_DOC_LINK = 'https://docs.sentry.io/product/alerts/uptime-monitoring/';

export const MODULE_FEATURES = ['uptime', 'insights-uptime'];
export const MODULE_VISIBLE_FEATURES = ['uptime', 'insights-uptime'];
