import type {ReactElement} from 'react';

import CrashFreeSessionsChartWidget from 'sentry/views/insights/common/components/widgets/crashFreeSessionsChartWidget';
import NewAndResolvedIssueChartWidget from 'sentry/views/insights/common/components/widgets/newAndResolvedIssueChartWidget';
import ReleaseNewIssuesChartWidget from 'sentry/views/insights/common/components/widgets/releaseNewIssuesChartWidget';
import ReleaseSessionCountChartWidget from 'sentry/views/insights/common/components/widgets/releaseSessionCountChartWidget';
import ReleaseSessionPercentageChartWidget from 'sentry/views/insights/common/components/widgets/releaseSessionPercentageChartWidget';
import SessionHealthCountChartWidget from 'sentry/views/insights/common/components/widgets/sessionHealthCountChartWidget';
import SessionHealthRateChartWidget from 'sentry/views/insights/common/components/widgets/sessionHealthRateChartWidget';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import UnhealthySessionsChartWidget from 'sentry/views/insights/common/components/widgets/unhealthySessionsChartWidget';
import UserHealthCountChartWidget from 'sentry/views/insights/common/components/widgets/userHealthCountChartWidget';
import UserHealthRateChartWidget from 'sentry/views/insights/common/components/widgets/userHealthRateChartWidget';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';
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
  'ai-agents': [],
  mcp: [],
};

export const DEFAULT_LAYOUTS: Record<
  DomainView,
  ReadonlyArray<keyof typeof CHART_MAP | undefined>
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
  'ai-agents': [],
  mcp: [],
};
