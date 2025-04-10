import type {ReactElement} from 'react';

import type {Project} from 'sentry/types/project';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';
import CrashFreeSessionsChart from 'sentry/views/insights/sessions/charts/crashFreeSessionsChart';
import ErroredSessionsChart from 'sentry/views/insights/sessions/charts/erroredSessionsChart';
import NewAndResolvedIssueChart from 'sentry/views/insights/sessions/charts/newAndResolvedIssueChart';
import ReleaseNewIssuesChart from 'sentry/views/insights/sessions/charts/releaseNewIssuesChart';
import ReleaseSessionCountChart from 'sentry/views/insights/sessions/charts/releaseSessionCountChart';
import ReleaseSessionPercentageChart from 'sentry/views/insights/sessions/charts/releaseSessionPercentageChart';
import SessionHealthCountChart from 'sentry/views/insights/sessions/charts/sessionHealthCountChart';
import SessionHealthRateChart from 'sentry/views/insights/sessions/charts/sessionHealthRateChart';
import UserHealthCountChart from 'sentry/views/insights/sessions/charts/userHealthCountChart';
import UserHealthRateChart from 'sentry/views/insights/sessions/charts/userHealthRateChart';
import type {CHART_TITLES} from 'sentry/views/insights/sessions/settings';

export const CHART_MAP: Record<
  keyof typeof CHART_TITLES,
  (props: {project: Project}) => ReactElement
> = {
  CrashFreeSessionsChart,
  ErroredSessionsChart,
  NewAndResolvedIssueChart,
  ReleaseNewIssuesChart,
  ReleaseSessionCountChart,
  ReleaseSessionPercentageChart,
  SessionHealthCountChart,
  SessionHealthRateChart,
  UserHealthCountChart,
  UserHealthRateChart,
};

export const CHART_RENAMES: Record<string, keyof typeof CHART_TITLES> = {
  // Map from the old name to the new
  ErrorFreeSessionsChart: 'ErroredSessionsChart',
};

export const PAGE_CHART_OPTIONS: Record<
  DomainView,
  ReadonlyArray<keyof typeof CHART_MAP>
> = {
  frontend: [
    // ORDER MATTERS HERE
    // The order things are listed is the order rendered
    'ErroredSessionsChart',
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
    'ErroredSessionsChart',
    'UserHealthRateChart',
    'SessionHealthRateChart',
    'SessionHealthCountChart',
    'UserHealthCountChart',
  ],
  mobile: [
    // ORDER MATTERS HERE
    // The order represents the default chart layout for Mobile > Session Health
    'CrashFreeSessionsChart',
    'ReleaseSessionPercentageChart',
    'ReleaseNewIssuesChart',
    'ReleaseSessionCountChart',
    'UserHealthRateChart',
  ],
  backend: [],
  ai: [],
};
