import {dashboardsEventMap, DashboardsEventParameters} from './dashboardsAnalyticsEvents';
import {growthEventMap, GrowthEventParameters} from './growthAnalyticsEvents';
import {issueEventMap, IssueEventParameters} from './issueAnalyticsEvents';
import makeAnalyticsFunction from './makeAnalyticsFunction';
import {
  performanceEventMap,
  PerformanceEventParameters,
} from './performanceAnalyticsEvents';

type EventParameters = GrowthEventParameters &
  IssueEventParameters &
  PerformanceEventParameters &
  DashboardsEventParameters;

const allEventMap = {
  ...growthEventMap,
  ...issueEventMap,
  ...performanceEventMap,
  ...dashboardsEventMap,
};

/**
 * Generic typed analytics function for growth, issue, and performance events.
 * Can split up analytics functions to a smaller set of events like we do for trackIntegrationAnalytics
 */
const trackAdvancedAnalyticsEvent = makeAnalyticsFunction<EventParameters>(allEventMap);

export default trackAdvancedAnalyticsEvent;
