import {t} from 'sentry/locale';

export const MODULE_TITLE = t('Session Health');

export const DATA_TYPE = t('Session');
export const DATA_TYPE_PLURAL = t('Sessions');
export const BASE_URL = 'sessions';

export const MOBILE_MODULE_DOC_LINK =
  'https://docs.sentry.io/product/insights/mobile/session-health/';
export const FRONTEND_MODULE_DOC_LINK =
  'https://docs.sentry.io/product/insights/frontend/session-health/';

export const CHART_TITLES = {
  CrashFreeSessionsChartWidget: t('Crash Free Sessions'),
  UnhealthySessionsChartWidget: t('Unhealthy Sessions'),
  NewAndResolvedIssueChartWidget: t('Issues'),
  ReleaseNewIssuesChartWidget: t('New Issues by Release'),
  ReleaseSessionCountChartWidget: t('Total Sessions by Release'),
  ReleaseSessionPercentageChartWidget: t('Release Adoption'),
  SessionHealthCountChartWidget: t('Session Counts'),
  SessionHealthRateChartWidget: t('Session Health'),
  UserHealthCountChartWidget: t('User Counts'),
  UserHealthRateChartWidget: t('User Health'),
};
