import {
  alertsEventMap,
  type AlertsEventParameters,
} from 'sentry/utils/analytics/alertsAnalyticsEvents';
import {
  commandPaletteEventMap,
  type CommandPaletteEventParameters,
} from 'sentry/utils/analytics/commandPaletteAnalyticsEvents';
import {
  exploreAnalyticsEventMap,
  type ExploreAnalyticsEventParameters,
} from 'sentry/utils/analytics/exploreAnalyticsEvents';
import {
  featureFlagEventMap,
  type FeatureFlagEventParameters,
} from 'sentry/utils/analytics/featureFlagAnalyticsEvents';
import {
  gamingEventMap,
  type GamingAnalyticsEventParameters,
} from 'sentry/utils/analytics/gamingAnalyticsEvents';
import {
  logsAnalyticsEventMap,
  type LogsAnalyticsEventParameters,
} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {
  metricsAnalyticsEventMap,
  type MetricsAnalyticsEventParameters,
} from 'sentry/utils/analytics/metricsAnalyticsEvent';
import {navigationAnalyticsEventMap} from 'sentry/utils/analytics/navigationAnalyticsEvents';
import {nextJsInsightsEventMap} from 'sentry/utils/analytics/nextJsInsightsAnalyticsEvents';
import {
  quickStartEventMap,
  type QuickStartEventParameters,
} from 'sentry/utils/analytics/quickStartAnalyticsEvents';
import {
  statsEventMap,
  type StatsEventParameters,
} from 'sentry/utils/analytics/statsAnalyticsEvents';

import type {AgentMonitoringEventParameters} from './analytics/agentMonitoringAnalyticsEvents';
import {agentMonitoringEventMap} from './analytics/agentMonitoringAnalyticsEvents';
import type {AuthV2EventParameters} from './analytics/authV2AnalyticsEvents';
import {authV2EventMap} from './analytics/authV2AnalyticsEvents';
import type {BreadcrumbsAnalyticsEventParameters} from './analytics/breadcrumbsAnalyticsEvents';
import {breadcrumbsAnalyticsEventMap} from './analytics/breadcrumbsAnalyticsEvents';
import type {ConversationsEventParameters} from './analytics/conversationsAnalyticsEvents';
import {conversationsEventMap} from './analytics/conversationsAnalyticsEvents';
import type {CoreUIEventParameters} from './analytics/coreuiAnalyticsEvents';
import {coreUIEventMap} from './analytics/coreuiAnalyticsEvents';
import type {DashboardsEventParameters} from './analytics/dashboardsAnalyticsEvents';
import {dashboardsEventMap} from './analytics/dashboardsAnalyticsEvents';
import type {DiscoverEventParameters} from './analytics/discoverAnalyticsEvents';
import {discoverEventMap} from './analytics/discoverAnalyticsEvents';
import type {DynamicSamplingEventParameters} from './analytics/dynamicSamplingAnalyticsEvents';
import {dynamicSamplingEventMap} from './analytics/dynamicSamplingAnalyticsEvents';
import type {EcosystemEventParameters} from './analytics/ecosystemAnalyticsEvents';
import {ecosystemEventMap} from './analytics/ecosystemAnalyticsEvents';
import type {FeedbackEventParameters} from './analytics/feedbackAnalyticsEvents';
import {feedbackEventMap} from './analytics/feedbackAnalyticsEvents';
import type {GrowthEventParameters} from './analytics/growthAnalyticsEvents';
import {growthEventMap} from './analytics/growthAnalyticsEvents';
import type {InsightEventParameters} from './analytics/insightAnalyticEvents';
import {insightEventMap} from './analytics/insightAnalyticEvents';
import type {IntegrationEventParameters} from './analytics/integrations';
import {integrationEventMap} from './analytics/integrations';
import type {IssueEventParameters} from './analytics/issueAnalyticsEvents';
import {issueEventMap} from './analytics/issueAnalyticsEvents';
import type {LaravelInsightsEventParameters} from './analytics/laravelInsightsAnalyticsEvents';
import {laravelInsightsEventMap} from './analytics/laravelInsightsAnalyticsEvents';
import {makeAnalyticsFunction} from './analytics/makeAnalyticsFunction';
import type {McpMonitoringEventParameters} from './analytics/mcpMonitoringAnalyticsEvents';
import {mcpMonitoringEventMap} from './analytics/mcpMonitoringAnalyticsEvents';
import type {MonitorsEventParameters} from './analytics/monitorsAnalyticsEvents';
import {monitorsEventMap} from './analytics/monitorsAnalyticsEvents';
import type {OnboardingEventParameters} from './analytics/onboardingAnalyticsEvents';
import {onboardingEventMap} from './analytics/onboardingAnalyticsEvents';
import type {PerformanceEventParameters} from './analytics/performanceAnalyticsEvents';
import {performanceEventMap} from './analytics/performanceAnalyticsEvents';
import type {PreprodBuildEventParameters} from './analytics/preprodBuildAnalyticsEvents';
import {preprodBuildEventMap} from './analytics/preprodBuildAnalyticsEvents';
import type {ProfilingEventParameters} from './analytics/profilingAnalyticsEvents';
import {profilingEventMap} from './analytics/profilingAnalyticsEvents';
import type {ProjectCreationEventParameters} from './analytics/projectCreationAnalyticsEvents';
import {projectCreationEventMap} from './analytics/projectCreationAnalyticsEvents';
import type {ReleasesEventParameters} from './analytics/releasesAnalyticsEvents';
import {releasesEventMap} from './analytics/releasesAnalyticsEvents';
import type {ReplayEventParameters} from './analytics/replayAnalyticsEvents';
import {replayEventMap} from './analytics/replayAnalyticsEvents';
import type {SearchEventParameters} from './analytics/searchAnalyticsEvents';
import {searchEventMap} from './analytics/searchAnalyticsEvents';
import {seerAnalyticsEventsMap} from './analytics/seerAnalyticsEvents';
import type {SeerAnalyticsEventsParameters} from './analytics/seerAnalyticsEvents';
import type {SettingsEventParameters} from './analytics/settingsAnalyticsEvents';
import {settingsEventMap} from './analytics/settingsAnalyticsEvents';
import type {SignupAnalyticsParameters} from './analytics/signupAnalyticsEvents';
import {signupEventMap} from './analytics/signupAnalyticsEvents';
import type {StackTraceEventParameters} from './analytics/stackTraceAnalyticsEvents';
import {stackTraceEventMap} from './analytics/stackTraceAnalyticsEvents';
import {starfishEventMap} from './analytics/starfishAnalyticsEvents';
import type {TempestEventParameters} from './analytics/tempestAnalyticsEvents';
import {tempestEventMap} from './analytics/tempestAnalyticsEvents';
import {tracingEventMap, type TracingEventParameters} from './analytics/tracingEventMap';
import type {TeamInsightsEventParameters} from './analytics/workflowAnalyticsEvents';
import {workflowEventMap} from './analytics/workflowAnalyticsEvents';

interface EventParameters
  extends
    CommandPaletteEventParameters,
    AuthV2EventParameters,
    GrowthEventParameters,
    AgentMonitoringEventParameters,
    AlertsEventParameters,
    ConversationsEventParameters,
    BreadcrumbsAnalyticsEventParameters,
    CoreUIEventParameters,
    DashboardsEventParameters,
    DiscoverEventParameters,
    FeatureFlagEventParameters,
    FeedbackEventParameters,
    InsightEventParameters,
    IssueEventParameters,
    LaravelInsightsEventParameters,
    McpMonitoringEventParameters,
    MonitorsEventParameters,
    PerformanceEventParameters,
    ProfilingEventParameters,
    PreprodBuildEventParameters,
    ReleasesEventParameters,
    ReplayEventParameters,
    SearchEventParameters,
    SeerAnalyticsEventsParameters,
    SettingsEventParameters,
    TeamInsightsEventParameters,
    DynamicSamplingEventParameters,
    OnboardingEventParameters,
    GamingAnalyticsEventParameters,
    StackTraceEventParameters,
    EcosystemEventParameters,
    IntegrationEventParameters,
    ProjectCreationEventParameters,
    SignupAnalyticsParameters,
    LogsAnalyticsEventParameters,
    MetricsAnalyticsEventParameters,
    TracingEventParameters,
    StatsEventParameters,
    ExploreAnalyticsEventParameters,
    QuickStartEventParameters,
    TempestEventParameters,
    Record<string, Record<string, any>> {}

const allEventMap: Record<string, string | null> = {
  ...commandPaletteEventMap,
  ...authV2EventMap,
  ...agentMonitoringEventMap,
  ...alertsEventMap,
  ...conversationsEventMap,
  ...breadcrumbsAnalyticsEventMap,
  ...coreUIEventMap,
  ...dashboardsEventMap,
  ...discoverEventMap,
  ...featureFlagEventMap,
  ...feedbackEventMap,
  ...growthEventMap,
  ...insightEventMap,
  ...issueEventMap,
  ...laravelInsightsEventMap,
  ...monitorsEventMap,
  ...nextJsInsightsEventMap,
  ...performanceEventMap,
  ...preprodBuildEventMap,
  ...tracingEventMap,
  ...profilingEventMap,
  ...exploreAnalyticsEventMap,
  ...logsAnalyticsEventMap,
  ...metricsAnalyticsEventMap,
  ...releasesEventMap,
  ...replayEventMap,
  ...searchEventMap,
  ...seerAnalyticsEventsMap,
  ...settingsEventMap,
  ...workflowEventMap,
  ...dynamicSamplingEventMap,
  ...onboardingEventMap,
  ...gamingEventMap,
  ...stackTraceEventMap,
  ...ecosystemEventMap,
  ...integrationEventMap,
  ...projectCreationEventMap,
  ...starfishEventMap,
  ...signupEventMap,
  ...statsEventMap,
  ...quickStartEventMap,
  ...navigationAnalyticsEventMap,
  ...tempestEventMap,
  ...mcpMonitoringEventMap,
};

/**
 * Analytics and metric tracking functionality.
 *
 * These are primarily driven through hooks provided through the hook registry. For
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
 * This should be used with all analytics events regardless of the analytics
 * destination which includes Reload, Amplitude, and Google Analytics. All
 * events go to Reload. If eventName is defined, events also go to Amplitude.
 * For more details, refer to makeAnalyticsFunction.
 *
 * Should be used for all analytics that are defined in Sentry.
 */
export const trackAnalytics = makeAnalyticsFunction<EventParameters>(allEventMap);

// JSDOM implements window.performance but not window.performance.mark
export const CAN_MARK =
  window.performance &&
  typeof window.performance.mark === 'function' &&
  typeof window.performance.measure === 'function' &&
  typeof window.performance.getEntriesByName === 'function' &&
  typeof window.performance.clearMeasures === 'function';
