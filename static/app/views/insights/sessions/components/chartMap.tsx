import type {ReactElement} from 'react';

import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';
import CrashFreeSessionsChartWidget from 'sentry/views/insights/sessions/charts/crashFreeSessionsChartWidget';
import NewAndResolvedIssueChartWidget from 'sentry/views/insights/sessions/charts/newAndResolvedIssueChartWidget';
import ReleaseNewIssuesChartWidget from 'sentry/views/insights/sessions/charts/releaseNewIssuesChartWidget';
import ReleaseSessionCountChartWidget from 'sentry/views/insights/sessions/charts/releaseSessionCountChartWidget';
import ReleaseSessionPercentageChartWidget from 'sentry/views/insights/sessions/charts/releaseSessionPercentageChartWidget';
import SessionHealthCountChartWidget from 'sentry/views/insights/sessions/charts/sessionHealthCountChartWidget';
import SessionHealthRateChartWidget from 'sentry/views/insights/sessions/charts/sessionHealthRateChartWidget';
import UnhealthySessionsChartWidget from 'sentry/views/insights/sessions/charts/unhealthySessionsChartWidget';
import UserHealthCountChartWidget from 'sentry/views/insights/sessions/charts/userHealthCountChartWidget';
import UserHealthRateChartWidget from 'sentry/views/insights/sessions/charts/userHealthRateChartWidget';
import type {CHART_TITLES} from 'sentry/views/insights/sessions/settings';

export const CHART_MAP: Record<
  keyof typeof CHART_TITLES,
  (props: LoadableChartWidgetProps) => ReactElement
> = {
  CrashFreeSessionsChartWidget,
  UnhealthySessionsChartWidget,
  ReleaseSessionCountChartWidget,
  ReleaseSessionPercentageChartWidget,
  SessionHealthCountChartWidget,
  SessionHealthRateChartWidget,
  UserHealthCountChartWidget,
  UserHealthRateChartWidget,
  NewAndResolvedIssueChartWidget,
  ReleaseNewIssuesChartWidget,
};

export const CHART_RENAMES: Record<string, keyof typeof CHART_TITLES> = {
  // Map from the old name to the new
  ErrorFreeSessionsChart: 'UnhealthySessionsChartWidget',
  ErroredSessionsChart: 'UnhealthySessionsChartWidget',
  ReleaseSessionPercentageChart: 'ReleaseSessionPercentageChartWidget',
  ReleaseSessionCountChart: 'ReleaseSessionCountChartWidget',
  SessionHealthRateChart: 'SessionHealthRateChartWidget',
  SessionHealthCountChart: 'SessionHealthCountChartWidget',
  UserHealthRateChart: 'UserHealthRateChartWidget',
  UserHealthCountChart: 'UserHealthCountChartWidget',
  NewAndResolvedIssueChart: 'NewAndResolvedIssueChartWidget',
  ReleaseNewIssuesChart: 'ReleaseNewIssuesChartWidget',
};

export const PAGE_CHART_OPTIONS: Record<
  DomainView,
  ReadonlyArray<keyof typeof CHART_MAP>
> = {
  frontend: [
    // ORDER MATTERS HERE
    // The order things are listed is the order rendered
    'UnhealthySessionsChartWidget',
    'NewAndResolvedIssueChartWidget',
    'SessionHealthCountChartWidget',
    'SessionHealthRateChartWidget',
    'UserHealthCountChartWidget',
    'UserHealthRateChartWidget',
  ],
  mobile: [
    // ORDER MATTERS HERE
    // The order things are listed is the order rendered
    'CrashFreeSessionsChartWidget',
    'ReleaseNewIssuesChartWidget',
    'ReleaseSessionCountChartWidget',
    'ReleaseSessionPercentageChartWidget',
    'SessionHealthCountChartWidget',
    'SessionHealthRateChartWidget',
    'UserHealthCountChartWidget',
    'UserHealthRateChartWidget',
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
    'UnhealthySessionsChartWidget',
    'UserHealthRateChartWidget',
    'SessionHealthRateChartWidget',
    'SessionHealthCountChartWidget',
    'UserHealthCountChartWidget',
  ],
  mobile: [
    // ORDER MATTERS HERE
    // The order represents the default chart layout for Mobile > Session Health
    'CrashFreeSessionsChartWidget',
    'ReleaseSessionPercentageChartWidget',
    'ReleaseNewIssuesChartWidget',
    'ReleaseSessionCountChartWidget',
    'UserHealthRateChartWidget',
  ],
  backend: [],
  ai: [],
};
