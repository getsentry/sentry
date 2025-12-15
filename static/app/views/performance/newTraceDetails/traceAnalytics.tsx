import * as qs from 'query-string';

import type {Organization} from 'sentry/types/organization';
import type {PlatformKey, Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';

import type {TraceDrawerActionKind} from './traceDrawer/details/utils';
import type {TraceShape, TraceTree} from './traceModels/traceTree';

export type TraceTreeSource =
  | 'trace_view'
  | 'replay_details'
  | 'issue_details_trace_preview'
  | 'issue_details_span_evidence'
  | 'issue_details_anr_root_cause';

const trackTraceSuccessState = (
  tree: TraceTree,
  projects: Project[],
  organization: Organization,
  hasExceededPerformanceUsageLimit: boolean | null,
  source: TraceTreeSource,
  traceAge: string,
  issuesCount: number,
  eapSpansCount: number
) => {
  // space[1] represents the node duration (in milliseconds)
  const trace_duration_seconds = (tree.root.space?.[1] ?? 0) / 1000;
  const projectSlugs = [
    ...new Set(
      tree.list.map(node => node.projectSlug).filter(slug => slug !== undefined)
    ),
  ];

  const projectPlatforms = projects
    .filter(p => projectSlugs.includes(p.slug))
    .map(project => project?.platform ?? '');

  const query = qs.parse(location.search);

  trackAnalytics('trace.metadata', {
    shape: tree.shape,
    // round trace_duration_seconds to nearest two decimal places
    trace_duration_seconds: Math.round(trace_duration_seconds * 100) / 100,
    has_exceeded_performance_usage_limit: hasExceededPerformanceUsageLimit,
    referrer: query.source?.toString() || null,
    num_root_children: tree.root.children.length,
    num_nodes: tree.list.length,
    project_platforms: projectPlatforms,
    organization,
    source,
    trace_age: traceAge,
    issues_count: issuesCount,
    eap_spans_count: eapSpansCount,
  });
};

const trackLayoutChange = (layout: string, organization: Organization) =>
  trackAnalytics('trace.trace_layout.change', {
    layout,
    organization,
  });

const trackDrawerMinimize = (organization: Organization) =>
  trackAnalytics('trace.trace_layout.drawer_minimize', {
    organization,
  });

const trackExploreSearch = (
  organization: Organization,
  key: string,
  value: string | number,
  kind: TraceDrawerActionKind,
  source: 'drawer' | 'toolbar_menu'
) =>
  trackAnalytics('trace.trace_drawer_explore_search', {
    organization,
    key,
    value,
    kind,
    source,
  });

const trackShowInView = (organization: Organization) =>
  trackAnalytics('trace.trace_layout.show_in_view', {
    organization,
  });

const trackTracingOnboarding = (
  organization: Organization,
  platform: PlatformKey,
  supports_performance: boolean,
  supports_onboarding_checklist: boolean
) =>
  trackAnalytics('trace.tracing_onboarding', {
    organization,
    platform,
    supports_performance,
    supports_onboarding_checklist,
  });

const trackPlatformDocsViewed = (organization: Organization, platform: string) =>
  trackAnalytics('trace.tracing_onboarding_platform_docs_viewed', {
    organization,
    platform,
  });

const trackPerformanceSetupDocsViewed = (organization: Organization, platform: string) =>
  trackAnalytics('trace.tracing_onboarding_performance_docs_viewed', {
    organization,
    platform,
  });

const trackViewEventJSON = (organization: Organization) =>
  trackAnalytics('trace.trace_layout.view_event_json', {
    organization,
  });
const trackViewContinuousProfile = (organization: Organization) => {
  trackAnalytics('trace.trace_layout.view_continuous_profile', {
    organization,
  });
  trackAnalytics('profiling_views.go_to_flamegraph', {
    organization,
    source: 'performance.trace_view.details',
  });
};
const trackViewTransactionProfile = (organization: Organization) => {
  trackAnalytics('trace.trace_layout.view_transaction_profile', {
    organization,
  });
  trackAnalytics('profiling_views.go_to_flamegraph', {
    organization,
    source: 'performance.trace_view.details',
  });
};

const trackTabPin = (organization: Organization) =>
  trackAnalytics('trace.trace_layout.tab_pin', {
    organization,
  });

const trackTabView = (tab: string, organization: Organization) =>
  trackAnalytics('trace.trace_layout.tab_view', {
    organization,
    tab,
  });

const trackSearchFocus = (organization: Organization) =>
  trackAnalytics('trace.trace_layout.search_focus', {
    organization,
  });

const trackEAPSpanHasDetails = (
  organization: Organization,
  hasProfileDetails: boolean,
  hasLogsDetails: boolean
) =>
  trackAnalytics('trace.trace_drawer_details.eap_span_has_details', {
    organization,
    has_profile_details: hasProfileDetails,
    has_logs_details: hasLogsDetails,
  });

const trackResetZoom = (organization: Organization) =>
  trackAnalytics('trace.trace_layout.reset_zoom', {
    organization,
  });

const trackPerformanceSetupChecklistTriggered = (organization: Organization) =>
  trackAnalytics('trace.quality.performance_setup.checklist_triggered', {
    organization,
  });

const trackPerformanceSetupBannerLoaded = (organization: Organization) =>
  trackAnalytics('trace.quality.performance_setup.banner_loaded', {
    organization,
  });

const trackQuotaExceededIncreaseBudgetClicked = (
  organization: Organization,
  traceType: string
) =>
  trackAnalytics('trace.quality.quota_exceeded.increase_budget_clicked', {
    organization,
    traceType,
  });

const trackMissingSpansDocLinkClicked = (organization: Organization) =>
  trackAnalytics('trace.quality.missing_spans.doc_link_clicked', {
    organization,
  });

const trackTraceEmptyState = (organization: Organization, source: TraceTreeSource) =>
  trackAnalytics('trace.load.empty_state', {
    organization,
    source,
  });

const trackTraceErrorState = (
  organization: Organization,
  source: TraceTreeSource,
  span_count: number | null,
  error_status: number | null
) =>
  trackAnalytics('trace.load.error_state', {
    organization,
    source,
    span_count,
    error_status,
  });

const trackQuotaExceededLearnMoreClicked = (
  organization: Organization,
  traceType: string
) =>
  trackAnalytics('trace.quality.quota_exceeded.learn_more_clicked', {
    organization,
    traceType,
  });

const trackQuotaExceededBannerLoaded = (organization: Organization, traceType: string) =>
  trackAnalytics('trace.quality.quota_exceeded.banner_loaded', {
    organization,
    traceType,
  });

const trackPerformanceSetupLearnMoreClicked = (organization: Organization) =>
  trackAnalytics('trace.quality.performance_setup.learn_more_clicked', {
    organization,
  });

const trackViewShortcuts = (organization: Organization) =>
  trackAnalytics('trace.trace_layout.view_shortcuts', {
    organization,
  });

const trackTraceWarningType = (type: TraceShape, organization: Organization) =>
  trackAnalytics('trace.trace_warning_type', {
    organization,
    type,
  });

const trackTraceConfigurationsDocsClicked = (organization: Organization, title: string) =>
  trackAnalytics('trace.configurations_docs_link_clicked', {
    organization,
    title,
  });

const trackAutogroupingPreferenceChange = (
  organization: Organization,
  enabled: boolean
) =>
  trackAnalytics('trace.preferences.autogrouping_change', {
    organization,
    enabled,
  });

const trackMissingInstrumentationPreferenceChange = (
  organization: Organization,
  enabled: boolean
) =>
  trackAnalytics('trace.preferences.missing_instrumentation_change', {
    organization,
    enabled,
  });

const traceAnalytics = {
  // Trace Onboarding
  trackTracingOnboarding,
  trackPlatformDocsViewed,
  trackPerformanceSetupDocsViewed,
  // Trace shape
  trackTraceSuccessState,
  trackTraceEmptyState,
  trackTraceErrorState,
  // Drawer actions
  trackExploreSearch,
  trackShowInView,
  trackViewEventJSON,
  trackViewContinuousProfile,
  trackViewTransactionProfile,
  // Layout actions
  trackLayoutChange,
  trackDrawerMinimize,
  trackSearchFocus,
  trackTabPin,
  trackTabView,
  // Toolbar actions
  trackResetZoom,
  trackViewShortcuts,
  trackTraceWarningType,
  // Trace Quality Improvement
  trackPerformanceSetupChecklistTriggered,
  trackPerformanceSetupLearnMoreClicked,
  trackPerformanceSetupBannerLoaded,
  trackQuotaExceededIncreaseBudgetClicked,
  trackQuotaExceededLearnMoreClicked,
  trackQuotaExceededBannerLoaded,
  trackTraceConfigurationsDocsClicked,
  trackMissingSpansDocLinkClicked,
  // Trace Preferences
  trackAutogroupingPreferenceChange,
  trackMissingInstrumentationPreferenceChange,
  // Trace Drawer Details
  trackEAPSpanHasDetails,
};

export {traceAnalytics};
