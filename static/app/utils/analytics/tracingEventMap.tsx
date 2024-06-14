export type TracingEventParameters = {
  'trace.shape': {
    shape: string;
  };
  'trace.trace_layout.change': {
    layout: string;
  };
  'trace.trace_layout.drawer_minimize': {};
  'trace.trace_layout.reset_zoom': {};
  'trace.trace_layout.search_clear': {};
  'trace.trace_layout.search_focus': {};
  'trace.trace_layout.search_match_navigate': {
    direction: string;
    interaction: string;
  };
  'trace.trace_layout.show_in_view': {};
  'trace.trace_layout.tab_pin': {};
  'trace.trace_layout.tab_view': {
    tab: string;
  };
  'trace.trace_layout.view_event_json': {};
  'trace.trace_layout.view_in_insight_module': {
    module: string;
  };
  'trace.trace_layout.view_shortcuts': {};
  'trace.trace_layout.zoom_to_fill': {};
  'trace.trace_warning_type': {
    type: string;
  };
  'trace_explorer.add_span_condition': {};
  'trace_explorer.open_in_issues': {};
  'trace_explorer.open_trace': {};
  'trace_explorer.open_trace_span': {};
  'trace_explorer.remove_span_condition': {};
  'trace_explorer.search_failure': {
    error: string;
    queries: string[];
  };
  'trace_explorer.search_request': {
    queries: string[];
  };
  'trace_explorer.search_success': {
    has_data: boolean;
    queries: string[];
  };
  'trace_explorer.toggle_trace_details': {
    expanded: boolean;
  };
};

export type TracingEventKey = keyof TracingEventParameters;

export const tracingEventMap: Record<TracingEventKey, string | null> = {
  'trace.shape': 'Trace Shape',
  'trace.trace_layout.change': 'Changed Trace Layout',
  'trace.trace_layout.drawer_minimize': 'Minimized Trace Drawer',
  'trace.trace_layout.show_in_view': 'Clicked Show in View Action',
  'trace.trace_layout.view_event_json': 'Clicked View Event JSON Action',
  'trace.trace_layout.tab_pin': 'Pinned Trace Tab',
  'trace.trace_layout.tab_view': 'Viewed Trace Tab',
  'trace.trace_layout.search_focus': 'Focused Trace Search',
  'trace.trace_layout.reset_zoom': 'Reset Trace Zoom',
  'trace.trace_layout.view_shortcuts': 'Viewed Trace Shortcuts',
  'trace.trace_warning_type': 'Viewed Trace Warning Type',
  'trace.trace_layout.zoom_to_fill': 'Trace Zoom to Fill',
  'trace.trace_layout.search_clear': 'Clear Trace Search',
  'trace.trace_layout.view_in_insight_module': 'View Trace Span in Insight Module',
  'trace.trace_layout.search_match_navigate': 'Navigate Trace Search Matches',
  'trace_explorer.add_span_condition': 'Trace Explorer: Add Span Condition',
  'trace_explorer.open_in_issues': 'Trace Explorer: Open Trace in Issues',
  'trace_explorer.open_trace': 'Trace Explorer: Open Trace in Trace Viewer',
  'trace_explorer.open_trace_span': 'Trace Explorer: Open Trace Span in Trace Viewer',
  'trace_explorer.remove_span_condition': 'Trace Explorer: Remove Span Condition',
  'trace_explorer.toggle_trace_details': 'Trace Explorer: Toggle Trace Details in Table',
  'trace_explorer.search_failure': 'Trace Explorer: Search Failure',
  'trace_explorer.search_request': 'Trace Explorer: Search Request',
  'trace_explorer.search_success': 'Trace Explorer: Search Success',
};
