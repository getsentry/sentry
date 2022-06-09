import {coreUIEventMap, CoreUIEventParameters} from './coreuiAnalyticsEvents';
import {dashboardsEventMap, DashboardsEventParameters} from './dashboardsAnalyticsEvents';
import {discoverEventMap, DiscoverEventParameters} from './discoverAnalyticsEvents';
import {ecosystemEventMap, EcosystemEventParameters} from './ecosystemAnalyticsEvents';
import {growthEventMap, GrowthEventParameters} from './growthAnalyticsEvents';
import {issueEventMap, IssueEventParameters} from './issueAnalyticsEvents';
import makeAnalyticsFunction from './makeAnalyticsFunction';
import {
  performanceEventMap,
  PerformanceEventParameters,
} from './performanceAnalyticsEvents';
import {samplingEventMap, SamplingEventParameters} from './samplingAnalyticsEvents';
import {searchEventMap, SearchEventParameters} from './searchAnalyticsEvents';
import {settingsEventMap, SettingsEventParameters} from './settingsAnalyticsEvents';
import {TeamInsightsEventParameters, workflowEventMap} from './workflowAnalyticsEvents';

type EventParameters = GrowthEventParameters &
  IssueEventParameters &
  PerformanceEventParameters &
  DashboardsEventParameters &
  DiscoverEventParameters &
  TeamInsightsEventParameters &
  SearchEventParameters &
  SettingsEventParameters &
  CoreUIEventParameters &
  SamplingEventParameters &
  EcosystemEventParameters;

const allEventMap = {
  ...growthEventMap,
  ...issueEventMap,
  ...performanceEventMap,
  ...dashboardsEventMap,
  ...discoverEventMap,
  ...workflowEventMap,
  ...searchEventMap,
  ...settingsEventMap,
  ...coreUIEventMap,
  ...samplingEventMap,
  ...ecosystemEventMap,
};

/**
 * Generic typed analytics function for growth, issue, and performance events.
 * Can split up analytics functions to a smaller set of events like we do for trackIntegrationAnalytics
 */
const trackAdvancedAnalyticsEvent = makeAnalyticsFunction<EventParameters>(allEventMap);

export default trackAdvancedAnalyticsEvent;
