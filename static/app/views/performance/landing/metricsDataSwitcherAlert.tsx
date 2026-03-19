import type React from 'react';

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {EventView} from 'sentry/utils/discover/eventView';
import type {MetricDataSwitcherOutcome} from 'sentry/utils/performance/contexts/metricsCardinality';
import type {DiscoverQueryPageSource} from 'sentry/views/performance/utils';

interface MetricEnhancedDataAlertProps extends MetricDataSwitcherOutcome {
  eventView: EventView;
  organization: Organization;
  projects: Project[];
  source?: DiscoverQueryPageSource;
}

export function MetricsDataSwitcherAlert(
  _props: MetricEnhancedDataAlertProps
): React.ReactElement | null {
  return null;
}
