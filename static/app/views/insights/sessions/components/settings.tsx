import {t} from 'sentry/locale';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';
import CrashFreeSessionsChart from 'sentry/views/insights/sessions/charts/crashFreeSessionsChart';
import ErrorFreeSessionsChart from 'sentry/views/insights/sessions/charts/errorFreeSessionsChart';
import NewAndResolvedIssueChart from 'sentry/views/insights/sessions/charts/newAndResolvedIssueChart';
import ReleaseNewIssuesChart from 'sentry/views/insights/sessions/charts/releaseNewIssuesChart';
import ReleaseSessionCountChart from 'sentry/views/insights/sessions/charts/releaseSessionCountChart';
import ReleaseSessionPercentageChart from 'sentry/views/insights/sessions/charts/releaseSessionPercentageChart';
import SessionHealthCountChart from 'sentry/views/insights/sessions/charts/sessionHealthCountChart';
import SessionHealthRateChart from 'sentry/views/insights/sessions/charts/sessionHealthRateChart';
import UserHealthCountChart from 'sentry/views/insights/sessions/charts/userHealthCountChart';
import UserHealthRateChart from 'sentry/views/insights/sessions/charts/userHealthRateChart';

export const CHART_MAP = {
  CrashFreeSessionsChart,
  ErrorFreeSessionsChart,
  NewAndResolvedIssueChart: () => <NewAndResolvedIssueChart type="issue" />,
  NewAndResolvedFeedbackChart: () => <NewAndResolvedIssueChart type="feedback" />,
  ReleaseNewIssuesChart,
  ReleaseSessionCountChart,
  ReleaseSessionPercentageChart,
  SessionHealthCountChart,
  SessionHealthRateChart,
  UserHealthCountChart,
  UserHealthRateChart,
};

export const CHART_TITLES: Record<keyof typeof CHART_MAP, string> = {
  CrashFreeSessionsChart: t('Crash Free Sessions'),
  ErrorFreeSessionsChart: t('Error Free Sessions'),
  NewAndResolvedIssueChart: t('Issues'),
  NewAndResolvedFeedbackChart: t('User Feedback'),
  ReleaseNewIssuesChart: t('New Issues by Release'),
  ReleaseSessionCountChart: t('Total Sessions by Release'),
  ReleaseSessionPercentageChart: t('Release Adoption'),
  SessionHealthCountChart: t('Session Counts'),
  SessionHealthRateChart: t('Session Health'),
  UserHealthCountChart: t('User Counts'),
  UserHealthRateChart: t('User Health'),
};

export const PAGE_CHART_OPTIONS: Record<
  DomainView,
  ReadonlyArray<keyof typeof CHART_MAP>
> = {
  frontend: [
    // ORDER MATTERS HERE
    // The order things are listed is the order rendered
    'ErrorFreeSessionsChart',
    'NewAndResolvedIssueChart',
    'SessionHealthCountChart',
    'SessionHealthRateChart',
    'UserHealthCountChart',
    'UserHealthRateChart',
  ],
  mobile: [
    // ORDER MATTERS HERE
    // The order things are listed is the order rendered
    'CrashFreeSessionsChart',
    'ReleaseNewIssuesChart',
    'ReleaseSessionCountChart',
    'ReleaseSessionPercentageChart',
    'SessionHealthCountChart',
    'SessionHealthRateChart',
    'UserHealthCountChart',
    'UserHealthRateChart',
  ],
  backend: [],
  ai: [],
};

export const DEFAULT_LAYOUTS: Record<
  DomainView,
  ReadonlyArray<keyof typeof CHART_MAP>
> = {
  frontend: [
    // ORDER MATTERS HERE
    // The order represents the default chart layout for Frontend > Session Health
    'ErrorFreeSessionsChart',
    'UserHealthRateChart',
    'UserHealthCountChart',
    'NewAndResolvedIssueChart',
    'SessionHealthRateChart',
  ],
  mobile: [
    // ORDER MATTERS HERE
    // The order represents the default chart layout for Mobile > Session Health
    'CrashFreeSessionsChart',
    'ReleaseSessionPercentageChart',
    'ReleaseNewIssuesChart',
    'ReleaseSessionCountChart',
    'SessionHealthCountChart',
  ],
  backend: [],
  ai: [],
};
