export type TracingEventParameters = {
  'trace.shape': {
    shape: string;
  };
  'trace.trace_layout.change': {
    layout: string;
  };
  'trace.trace_layout.drawer_minimize': {};
  'trace.trace_layout.reset_zoom': {};
  'trace.trace_layout.search_focus': {};
  'trace.trace_layout.show_in_view': {};
  'trace.trace_layout.tab_pin': {};
  'trace.trace_layout.tab_view': {
    tab: string;
  };
  'trace.trace_layout.view_event_json': {};
  'trace.trace_layout.view_shortcuts': {};
  'trace.trace_warning_type': {
    type: string;
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
};
