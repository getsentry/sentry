import * as Sentry from '@sentry/react';
import {Transaction} from '@sentry/types';

import HookStore from 'sentry/stores/hookStore';
import {Hooks} from 'sentry/types/hooks';
import {ddmEventMap, DDMEventParameters} from 'sentry/utils/analytics/ddmAnalyticsEvents';

import {
  aiSuggestedSolutionEventMap,
  AiSuggestedSolutionEventParameters,
} from './analytics/aiSuggestedSolutionAnalyticsEvents';
import {coreUIEventMap, CoreUIEventParameters} from './analytics/coreuiAnalyticsEvents';
import {
  dashboardsEventMap,
  DashboardsEventParameters,
} from './analytics/dashboardsAnalyticsEvents';
import {
  discoverEventMap,
  DiscoverEventParameters,
} from './analytics/discoverAnalyticsEvents';
import {
  dynamicSamplingEventMap,
  DynamicSamplingEventParameters,
} from './analytics/dynamicSamplingAnalyticsEvents';
import {
  ecosystemEventMap,
  EcosystemEventParameters,
} from './analytics/ecosystemAnalyticsEvents';
import {
  feedbackEventMap,
  FeedbackEventParameters,
} from './analytics/feedbackAnalyticsEvents';
import {growthEventMap, GrowthEventParameters} from './analytics/growthAnalyticsEvents';
import {integrationEventMap, IntegrationEventParameters} from './analytics/integrations';
import {issueEventMap, IssueEventParameters} from './analytics/issueAnalyticsEvents';
import makeAnalyticsFunction from './analytics/makeAnalyticsFunction';
import {
  monitorsEventMap,
  MonitorsEventParameters,
} from './analytics/monitorsAnalyticsEvents';
import {
  onboardingEventMap,
  OnboardingEventParameters,
} from './analytics/onboardingAnalyticsEvents';
import {
  performanceEventMap,
  PerformanceEventParameters,
} from './analytics/performanceAnalyticsEvents';
import {
  profilingEventMap,
  ProfilingEventParameters,
} from './analytics/profilingAnalyticsEvents';
import {
  projectCreationEventMap,
  ProjectCreationEventParameters,
} from './analytics/projectCreationAnalyticsEvents';
import {
  releasesEventMap,
  ReleasesEventParameters,
} from './analytics/releasesAnalyticsEvents';
import {replayEventMap, ReplayEventParameters} from './analytics/replayAnalyticsEvents';
import {searchEventMap, SearchEventParameters} from './analytics/searchAnalyticsEvents';
import {
  settingsEventMap,
  SettingsEventParameters,
} from './analytics/settingsAnalyticsEvents';
import {
  SignupAnalyticsParameters,
  SignupEventMap,
} from './analytics/signupAnalyticsEvents';
import {
  stackTraceEventMap,
  StackTraceEventParameters,
} from './analytics/stackTraceAnalyticsEvents';
import {starfishEventMap} from './analytics/starfishAnalyticsEvents';
import {
  TeamInsightsEventParameters,
  workflowEventMap,
} from './analytics/workflowAnalyticsEvents';

interface EventParameters
  extends GrowthEventParameters,
    CoreUIEventParameters,
    DashboardsEventParameters,
    DDMEventParameters,
    DiscoverEventParameters,
    FeedbackEventParameters,
    IssueEventParameters,
    MonitorsEventParameters,
    PerformanceEventParameters,
    ProfilingEventParameters,
    ReleasesEventParameters,
    ReplayEventParameters,
    SearchEventParameters,
    SettingsEventParameters,
    TeamInsightsEventParameters,
    DynamicSamplingEventParameters,
    OnboardingEventParameters,
    StackTraceEventParameters,
    AiSuggestedSolutionEventParameters,
    EcosystemEventParameters,
    IntegrationEventParameters,
    ProjectCreationEventParameters,
    SignupAnalyticsParameters,
    Record<string, Record<string, any>> {}

const allEventMap: Record<string, string | null> = {
  ...coreUIEventMap,
  ...dashboardsEventMap,
  ...ddmEventMap,
  ...discoverEventMap,
  ...feedbackEventMap,
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
  ...onboardingEventMap,
  ...stackTraceEventMap,
  ...aiSuggestedSolutionEventMap,
  ...ecosystemEventMap,
  ...integrationEventMap,
  ...projectCreationEventMap,
  ...starfishEventMap,
  ...SignupEventMap,
};

/**
 * This should be with all analytics events regardless of the analytics destination
 * which includes Reload, Amplitude, and Google Analytics.
 * All events go to Reload. If eventName is defined, events also go to Amplitude.
 * For more details, refer to makeAnalyticsFunction.
 *
 * Should be used for all analytics that are defined in Sentry.
 */

export const trackAnalytics = makeAnalyticsFunction<EventParameters>(allEventMap);

/**
 * Analytics and metric tracking functionality.
 *
 * These are primarily driven through hooks provided through the hookstore. For
 * sentry.io these are currently mapped to our in-house analytics backend
 * 'Reload' and the Amplitude service.
 *
 * NOTE: sentry.io contributors, you will need to ensure that the eventKey
 *       passed exists as an event key in the Reload events.py configuration:
 *
 *       https://github.com/getsentry/reload/blob/master/reload_app/events.py
 *
 * NOTE: sentry.io contributors, if you are using `gauge` or `increment` the
 *       name must be added to the Reload metrics module:
 *
 *       https://github.com/getsentry/reload/blob/master/reload_app/metrics/__init__.py
 */

/**
 * This should be with all analytics events regardless of the analytics destination
 * which includes Reload, Amplitude, and Google Analytics.
 * All events go to Reload. If eventName is defined, events also go to Amplitude.
 * For more details, refer to the API defined in hooks.
 *
 * Should NOT be used directly.
 * Instead, use makeAnalyticsFunction to generate an analytics function.
 */
export const rawTrackAnalyticsEvent: Hooks['analytics:raw-track-event'] = (
  data,
  options
) => HookStore.get('analytics:raw-track-event').forEach(cb => cb(data, options));

/**
 * This should be used to log when a `organization.experiments` experiment
 * variant is checked in the application.
 *
 * Refer for the backend implementation provided through HookStore for more
 * details.
 */
export const logExperiment: Hooks['analytics:log-experiment'] = options =>
  HookStore.get('analytics:log-experiment').forEach(cb => cb(options));

type RecordMetric = Hooks['metrics:event'] & {
  endTransaction: (opts: {
    /**
     * Name of the transaction to end
     */
    name: string;
  }) => void;

  mark: (opts: {
    /**
     * Name of the metric event
     */
    name: string;
    /**
     * Additional data that will be sent with measure()
     * This is useful if you want to track initial state
     */
    data?: object;
  }) => void;

  measure: (opts: {
    /**
     * Additional data to send with metric event.
     * If a key collide with the data in mark(), this will overwrite them
     */
    data?: object;
    /**
     * Name of ending mark
     */
    end?: string;
    /**
     * Name of the metric event
     */
    name?: string;
    /**
     * Do not clean up marks and measurements when completed
     */
    noCleanup?: boolean;
    /**
     * Name of starting mark
     */
    start?: string;
  }) => void;

  startTransaction: (opts: {
    /**
     * Name of transaction
     */
    name: string;
    /**
     * Optional op code
     */
    op?: string;
    /**
     * Optional trace id, defaults to current tx trace
     */
    traceId?: string;
  }) => Transaction;
};

/**
 * Used to pass data between metric.mark() and metric.measure()
 */
const metricDataStore = new Map<string, object>();

/**
 * Record metrics.
 */
export const metric: RecordMetric = (name, value, tags) =>
  HookStore.get('metrics:event').forEach(cb => cb(name, value, tags));

// JSDOM implements window.performance but not window.performance.mark
const CAN_MARK =
  window.performance &&
  typeof window.performance.mark === 'function' &&
  typeof window.performance.measure === 'function' &&
  typeof window.performance.getEntriesByName === 'function' &&
  typeof window.performance.clearMeasures === 'function';

metric.mark = function metricMark({name, data = {}}) {
  // Just ignore if browser is old enough that it doesn't support this
  if (!CAN_MARK) {
    return;
  }

  if (!name) {
    throw new Error('Invalid argument provided to `metric.mark`');
  }

  window.performance.mark(name);
  metricDataStore.set(name, data);
};

/**
 * Performs a measurement between `start` and `end` (or now if `end` is not
 * specified) Calls `metric` with `name` and the measured time difference.
 */
metric.measure = function metricMeasure({name, start, end, data = {}, noCleanup} = {}) {
  // Just ignore if browser is old enough that it doesn't support this
  if (!CAN_MARK) {
    return;
  }

  if (!name || !start) {
    throw new Error('Invalid arguments provided to `metric.measure`');
  }

  let endMarkName = end;

  // Can't destructure from performance
  const {performance} = window;

  // NOTE: Edge REQUIRES an end mark if it is given a start mark
  // If we don't have an end mark, create one now.
  if (!end) {
    endMarkName = `${start}-end`;
    performance.mark(endMarkName);
  }

  // Check if starting mark exists
  if (!performance.getEntriesByName(start, 'mark').length) {
    return;
  }

  performance.measure(name, start, endMarkName);
  const startData = metricDataStore.get(start) || {};

  // Retrieve measurement entries
  performance
    .getEntriesByName(name, 'measure')
    .forEach(measurement =>
      metric(measurement.name, measurement.duration, {...startData, ...data})
    );

  // By default, clean up measurements
  if (!noCleanup) {
    performance.clearMeasures(name);
    performance.clearMarks(start);
    performance.clearMarks(endMarkName);
    metricDataStore.delete(start);
  }
};

/**
 * Used to pass data between startTransaction and endTransaction
 */
const transactionDataStore = new Map<string, object>();

const getCurrentTransaction = () => {
  return Sentry.getCurrentHub().getScope()?.getTransaction();
};

metric.startTransaction = ({name, traceId, op}) => {
  if (!traceId) {
    traceId = getCurrentTransaction()?.traceId;
  }
  const transaction = Sentry.startTransaction({name, op, traceId});
  transactionDataStore[name] = transaction;
  return transaction;
};

metric.endTransaction = ({name}) => {
  const transaction = transactionDataStore[name];
  if (transaction) {
    transaction.finish();
  }
};
