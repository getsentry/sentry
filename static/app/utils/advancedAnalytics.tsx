import makeAnalyticsFunction from 'app/utils/analytics/makeAnalyticsFunction';
import {growthEventMap, GrowthEventParameters} from 'app/utils/growthAnalyticsEvents';
import {issueEventMap, IssueEventParameters} from 'app/utils/issueEvents';
import {
  performanceEventMap,
  PerformanceEventParameters,
} from 'app/utils/performanceEvents';

export type EventParameters = GrowthEventParameters &
  IssueEventParameters &
  PerformanceEventParameters;

const allEventMap = {
  ...growthEventMap,
  ...issueEventMap,
  ...performanceEventMap,
};

/**
 * Generic typed analytics function for growth, issue, and performance events.
 * Can split up analytics functions to a smaller set of events like we do for trackIntegrationEvent
 */
export const trackAdvancedAnalyticsEvent =
  makeAnalyticsFunction<EventParameters>(allEventMap);
