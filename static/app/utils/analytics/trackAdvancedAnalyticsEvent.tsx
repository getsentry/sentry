import {type CoreUIEventParameters, coreUIEventMap} from './coreuiAnalyticsEvents';
import {
  type DashboardsEventParameters,
  dashboardsEventMap,
} from './dashboardsAnalyticsEvents';
import {type DiscoverEventParameters, discoverEventMap} from './discoverAnalyticsEvents';
import {
  type DynamicSamplingEventParameters,
  dynamicSamplingEventMap,
} from './dynamicSamplingAnalyticsEvents';
import {type GrowthEventParameters, growthEventMap} from './growthAnalyticsEvents';
import {type IssueEventParameters, issueEventMap} from './issueAnalyticsEvents';
import makeAnalyticsFunction from './makeAnalyticsFunction';
import {type MonitorsEventParameters, monitorsEventMap} from './monitorsAnalyticsEvents';
import {
  type PerformanceEventParameters,
  performanceEventMap,
} from './performanceAnalyticsEvents';
import {
  type ProfilingEventParameters,
  profilingEventMap,
} from './profilingAnalyticsEvents';
import {type ReleasesEventParameters, releasesEventMap} from './releasesAnalyticsEvents';
import {type ReplayEventParameters, replayEventMap} from './replayAnalyticsEvents';
import {type SearchEventParameters, searchEventMap} from './searchAnalyticsEvents';
import {type SettingsEventParameters, settingsEventMap} from './settingsAnalyticsEvents';
import {
  type TeamInsightsEventParameters,
  workflowEventMap,
} from './workflowAnalyticsEvents';

type EventParameters = GrowthEventParameters &
  CoreUIEventParameters &
  DashboardsEventParameters &
  DiscoverEventParameters &
  IssueEventParameters &
  MonitorsEventParameters &
  PerformanceEventParameters &
  ProfilingEventParameters &
  ReleasesEventParameters &
  ReplayEventParameters &
  SearchEventParameters &
  SettingsEventParameters &
  TeamInsightsEventParameters &
  DynamicSamplingEventParameters;

const allEventMap: Record<string, string | null> = {
  ...coreUIEventMap,
  ...dashboardsEventMap,
  ...discoverEventMap,
  ...growthEventMap,
  ...issueEventMap,
  ...monitorsEventMap,
  ...performanceEventMap,
  ...profilingEventMap,
  ...releasesEventMap,
  ...replayEventMap,
  ...searchEventMap,
  ...settingsEventMap,
  ...workflowEventMap,
  ...dynamicSamplingEventMap,
};

/**
 * Generic typed analytics function for growth, issue, and performance events.
 * Can split up analytics functions to a smaller set of events like we do for trackIntegrationAnalytics
 */
const trackAdvancedAnalyticsEvent = makeAnalyticsFunction<EventParameters>(allEventMap);

export default trackAdvancedAnalyticsEvent;
