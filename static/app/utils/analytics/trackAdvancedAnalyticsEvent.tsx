import type {CoreUIEventParameters} from './coreuiAnalyticsEvents';
import {coreUIEventMap} from './coreuiAnalyticsEvents';
import type {DashboardsEventParameters} from './dashboardsAnalyticsEvents';
import {dashboardsEventMap} from './dashboardsAnalyticsEvents';
import type {DiscoverEventParameters} from './discoverAnalyticsEvents';
import {discoverEventMap} from './discoverAnalyticsEvents';
import type {DynamicSamplingEventParameters} from './dynamicSamplingAnalyticsEvents';
import {dynamicSamplingEventMap} from './dynamicSamplingAnalyticsEvents';
import type {GrowthEventParameters} from './growthAnalyticsEvents';
import {growthEventMap} from './growthAnalyticsEvents';
import type {IssueEventParameters} from './issueAnalyticsEvents';
import {issueEventMap} from './issueAnalyticsEvents';
import makeAnalyticsFunction from './makeAnalyticsFunction';
import type {MonitorsEventParameters} from './monitorsAnalyticsEvents';
import {monitorsEventMap} from './monitorsAnalyticsEvents';
import type {PerformanceEventParameters} from './performanceAnalyticsEvents';
import {performanceEventMap} from './performanceAnalyticsEvents';
import type {ProfilingEventParameters} from './profilingAnalyticsEvents';
import {profilingEventMap} from './profilingAnalyticsEvents';
import type {ReleasesEventParameters} from './releasesAnalyticsEvents';
import {releasesEventMap} from './releasesAnalyticsEvents';
import type {ReplayEventParameters} from './replayAnalyticsEvents';
import {replayEventMap} from './replayAnalyticsEvents';
import type {SearchEventParameters} from './searchAnalyticsEvents';
import {searchEventMap} from './searchAnalyticsEvents';
import type {SettingsEventParameters} from './settingsAnalyticsEvents';
import {settingsEventMap} from './settingsAnalyticsEvents';
import type {TeamInsightsEventParameters} from './workflowAnalyticsEvents';
import {workflowEventMap} from './workflowAnalyticsEvents';

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
