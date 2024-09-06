import * as Sentry from '@sentry/react';

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceType} from 'sentry/views/performance/newTraceDetails/traceType';

const trackTraceMetadata = (
  tree: TraceTree,
  projects: Project[],
  organization: Organization
) => {
  Sentry.metrics.increment(`trace.trace_shape.${tree.shape}`);

  // space[1] represents the node duration (in milliseconds)
  const trace_duration_seconds = (tree.root.space?.[1] ?? 0) / 1000;
  const projectSlugs = [
    ...new Set(
      tree.list.map(node => node.metadata.project_slug).filter(slug => slug !== undefined)
    ),
  ];

  const projectPlatforms = projects
    .filter(p => projectSlugs.includes(p.slug))
    .map(project => project?.platform ?? '');

  trackAnalytics('trace.metadata', {
    shape: tree.shape,
    // round trace_duration_seconds to nearest two decimal places
    trace_duration_seconds: Math.round(trace_duration_seconds * 100) / 100,
    num_root_children: tree.root.children.length,
    num_nodes: tree.list.length,
    project_platforms: projectPlatforms,
    organization,
  });
};

const trackFailedToFetchTraceState = () =>
  Sentry.metrics.increment('trace.failed_to_fetch_trace');

const trackEmptyTraceState = () => Sentry.metrics.increment('trace.empty_trace');

const trackLayoutChange = (layout: string, organization: Organization) =>
  trackAnalytics('trace.trace_layout.change', {
    layout,
    organization,
  });

const trackDrawerMinimize = (organization: Organization) =>
  trackAnalytics('trace.trace_layout.drawer_minimize', {
    organization,
  });

const trackShowInView = (organization: Organization) =>
  trackAnalytics('trace.trace_layout.show_in_view', {
    organization,
  });

const trackViewEventJSON = (organization: Organization) =>
  trackAnalytics('trace.trace_layout.view_event_json', {
    organization,
  });
const trackViewContinuousProfile = (organization: Organization) =>
  trackAnalytics('trace.trace_layout.view_continuous_profile', {
    organization,
  });

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

const trackTraceWarningType = (type: TraceType, organization: Organization) =>
  trackAnalytics('trace.trace_warning_type', {
    organization,
    type,
  });

const trackTraceConfigurationsDocsClicked = (organization: Organization, title: string) =>
  trackAnalytics('trace.configurations_docs_link_clicked', {
    organization,
    title,
  });

const traceAnalytics = {
  // Trace shape
  trackTraceMetadata,
  trackEmptyTraceState,
  trackFailedToFetchTraceState,
  // Drawer actions
  trackShowInView,
  trackViewEventJSON,
  trackViewContinuousProfile,
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
};

export {traceAnalytics};
