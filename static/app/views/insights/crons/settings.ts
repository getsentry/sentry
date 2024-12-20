import {t} from 'sentry/locale';

export const MODULE_TITLE = t('Cron Monitors');
export const MODULE_SIDEBAR_TITLE = t('Crons');
export const DATA_TYPE = t('Cron Check-In');
export const DATA_TYPE_PLURAL = t('Cron Check-Ins');
export const BASE_URL = 'crons';

export const MODULE_DESCRIPTION = t(
  'Scheduled monitors that check in on recurring jobs and tell you if they’re running on schedule, failing, or succeeding.'
);
export const MODULE_DOC_LINK = 'https://docs.sentry.io/product/crons/';

export const MODULE_FEATURES = ['insights-crons'];
export const MODULE_VISIBLE_FEATURES = ['insights-crons'];
