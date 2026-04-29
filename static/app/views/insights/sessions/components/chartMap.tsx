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
