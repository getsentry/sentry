import * as Sentry from '@sentry/react';

import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {TraceType} from 'sentry/views/performance/traceDetails/newTraceDetailsContent';

const trackTraceShape = (shape: TraceType, organization: Organization) => {
  Sentry.metrics.increment(`trace.trace_shape.${shape}`);
  trackAnalytics('trace.shape', {
    shape,
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

const trackViewShortcuts = (organization: Organization) =>
  trackAnalytics('trace.trace_layout.view_shortcuts', {
    organization,
  });

const trackTraceWarningType = (type: TraceType, organization: Organization) =>
  trackAnalytics('trace.trace_warning_type', {
    organization,
    type,
  });

const traceAnalytics = {
  // Trace shape
  trackTraceShape,
  trackEmptyTraceState,
  trackFailedToFetchTraceState,
  // Drawer actions
  trackShowInView,
  trackViewEventJSON,
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
};

export {traceAnalytics};
