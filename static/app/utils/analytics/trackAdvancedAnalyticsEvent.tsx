import {coreUIEventMap, CoreUIEventParameters} from './coreuiAnalyticsEvents';
import {dashboardsEventMap, DashboardsEventParameters} from './dashboardsAnalyticsEvents';
import {discoverEventMap, DiscoverEventParameters} from './discoverAnalyticsEvents';
import {
  dynamicSamplingEventMap,
  DynamicSamplingEventParameters,
} from './dynamicSamplingAnalyticsEvents';
import {growthEventMap, GrowthEventParameters} from './growthAnalyticsEvents';
import {issueEventMap, IssueEventParameters} from './issueAnalyticsEvents';
import makeAnalyticsFunction from './makeAnalyticsFunction';
import {monitorsEventMap, MonitorsEventParameters} from './monitorsAnalyticsEvents';
import {
  performanceEventMap,
  PerformanceEventParameters,
} from './performanceAnalyticsEvents';
import {profilingEventMap, ProfilingEventParameters} from './profilingAnalyticsEvents';
import {releasesEventMap, ReleasesEventParameters} from './releasesAnalyticsEvents';
import {replayEventMap, ReplayEventParameters} from './replayAnalyticsEvents';
import {samplingEventMap, SamplingEventParameters} from './samplingAnalyticsEvents';
import {searchEventMap, SearchEventParameters} from './searchAnalyticsEvents';
import {settingsEventMap, SettingsEventParameters} from './settingsAnalyticsEvents';
import {TeamInsightsEventParameters, workflowEventMap} from './workflowAnalyticsEvents';

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
  SamplingEventParameters &
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
  ...samplingEventMap,
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
