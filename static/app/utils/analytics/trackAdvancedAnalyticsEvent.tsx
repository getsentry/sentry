import {coreUIEventMap, CoreUIEventParameters} from './coreuiAnalyticsEvents';
import {dashboardsEventMap, DashboardsEventParameters} from './dashboardsAnalyticsEvents';
import {discoverEventMap, DiscoverEventParameters} from './discoverAnalyticsEvents';
import {growthEventMap, GrowthEventParameters} from './growthAnalyticsEvents';
import {issueEventMap, IssueEventParameters} from './issueAnalyticsEvents';
import makeAnalyticsFunction from './makeAnalyticsFunction';
import {
  performanceEventMap,
  PerformanceEventParameters,
} from './performanceAnalyticsEvents';
import {profilingEventMap} from './profilingAnalyticsEvents';
import {samplingEventMap, SamplingEventParameters} from './samplingAnalyticsEvents';
import {searchEventMap, SearchEventParameters} from './searchAnalyticsEvents';
import {settingsEventMap, SettingsEventParameters} from './settingsAnalyticsEvents';
import {TeamInsightsEventParameters, workflowEventMap} from './workflowAnalyticsEvents';

export interface AnalyticsEventParameters
  extends GrowthEventParameters,
    CoreUIEventParameters,
    DashboardsEventParameters,
    DiscoverEventParameters,
    IssueEventParameters,
    PerformanceEventParameters,
    SearchEventParameters,
    SettingsEventParameters,
    SamplingEventParameters,
    TeamInsightsEventParameters {}

const allEventMap: Record<keyof AnalyticsEventParameters, string | null> = {
  ...coreUIEventMap,
  ...dashboardsEventMap,
  ...discoverEventMap,
  ...growthEventMap,
  ...issueEventMap,
  ...performanceEventMap,
  ...profilingEventMap,
  ...samplingEventMap,
  ...searchEventMap,
  ...settingsEventMap,
  ...workflowEventMap,
};

/**
 * Generic typed analytics function for growth, issue, and performance events.
 * Can split up analytics functions to a smaller set of events like we do for trackIntegrationAnalytics
 */
const trackAdvancedAnalyticsEvent = makeAnalyticsFunction(allEventMap);

export default trackAdvancedAnalyticsEvent;
