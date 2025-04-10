import {t} from 'sentry/locale';

export const MODULE_TITLE = t('Session Health');

export const DATA_TYPE = t('Session');
export const DATA_TYPE_PLURAL = t('Sessions');
export const BASE_URL = 'sessions';

export const MODULE_DOC_LINK = 'https://docs.sentry.io/product/releases/setup/';

export const MODULE_VISIBLE_FEATURES = ['insights-session-health-tab-ui'];

export const CHART_TITLES = {
  CrashFreeSessionsChart: t('Crash Free Sessions'),
  ErroredSessionsChart: t('Errored Sessions'),
  NewAndResolvedIssueChart: t('Issues'),
  ReleaseNewIssuesChart: t('New Issues by Release'),
  ReleaseSessionCountChart: t('Total Sessions by Release'),
  ReleaseSessionPercentageChart: t('Release Adoption'),
  SessionHealthCountChart: t('Session Counts'),
  SessionHealthRateChart: t('Session Health'),
  UserHealthCountChart: t('User Counts'),
  UserHealthRateChart: t('User Health'),
};
