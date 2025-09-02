import type {PlatformKey} from 'sentry/types/project';

type ProfilingEventSource =
  | 'discover.transactions_table'
  | 'performance.trace_view.details'
  | 'performance.trace_view.missing_instrumentation'
  | 'performance.transactions_summary.overview'
  | 'performance.transactions_summary.suspect_functions'
  | 'profiling.landing.widget.function_trends.improvement'
  | 'profiling.landing.widget.function_trends.regression'
  | 'unknown'; // for compatibility in places soon to be removed

type NoParams = Record<string, unknown>;

export type ProfileSource = 'transaction profile' | 'continuous profile';

export type AggregateProfileSource =
  | 'differential aggregate flamegraph'
  | 'landing aggregate calltree'
  | 'landing aggregate flamegraph'
  | 'transaction aggregate calltree'
  | 'transaction aggregate flamegraph';

export type ProfilingEventParameters = {
  'profiling_views.aggregate_flamegraph.zoom.reset': {
    profile_type: AggregateProfileSource;
  };
  'profiling_views.aggregate_profile_flamegraph': {
    frame_filter: string;
    profile_type: AggregateProfileSource;
    render: 'initial' | 're-render';
    visualization: string;
  };
  'profiling_views.flamegraph.click.copy_function_name': {
    profile_type: ProfileSource | AggregateProfileSource;
  };
  'profiling_views.flamegraph.click.copy_function_source': {
    profile_type: ProfileSource | AggregateProfileSource;
  };
  'profiling_views.flamegraph.click.highlight_all_occurrences': {
    profile_type: ProfileSource | AggregateProfileSource;
  };
  'profiling_views.flamegraph.click.highlight_frame': {
    profile_type: ProfileSource | AggregateProfileSource;
  };
  'profiling_views.flamegraph.click.open_in': {
    profile_type: ProfileSource | AggregateProfileSource;
  };
  'profiling_views.flamegraph.click.profile': {
    profile_type: ProfileSource | AggregateProfileSource;
  };
  'profiling_views.flamegraph.thread.change': {
    profile_type: ProfileSource;
  };
  'profiling_views.flamegraph.zoom.reset': {
    profile_type: ProfileSource;
  };
  'profiling_views.go_to_flamegraph': {
    source: ProfilingEventSource;
  };
  'profiling_views.go_to_transaction': NoParams;
  'profiling_views.landing': {
    data: 'populated' | 'empty' | 'errored';
  };
  'profiling_views.landing.tab.transaction_click': NoParams;
  'profiling_views.landing.tab_change': {
    tab: 'flamegraph' | 'transactions';
  };
  'profiling_views.landing.widget.function_change': {
    source: string;
  };
  'profiling_views.landing.widget.open_list': {
    source: string;
  };
  'profiling_views.landing.widget.pagination': {
    direction: string;
    source: string;
  };
  'profiling_views.landing.widget_change': {
    source: string;
    target: string;
  };
  'profiling_views.profile_flamegraph': {
    colorCoding: string;
    project_platform: PlatformKey | undefined;
    render: 'initial' | 're-render';
    sorting: string;
    view: string;
  };
  'profiling_views.trace.profile_context.pagination': {
    direction: string;
  };
};

type EventKey = keyof ProfilingEventParameters;

export const profilingEventMap: Record<EventKey, string> = {
  'profiling_views.flamegraph.click.copy_function_name':
    'Profiling Views: Aggregate Flamegraph Click Copy Function Name',
  'profiling_views.flamegraph.click.copy_function_source':
    'Profiling Views: Aggregate Flamegraph Click Copy Source Location',
  'profiling_views.flamegraph.click.highlight_all_occurrences':
    'Profiling Views: Aggregate Flamegraph Click Highligh All Occurrences',
  'profiling_views.flamegraph.click.open_in':
    'Profiling Views: Aggregate Flamegraph Click Open In',
  'profiling_views.flamegraph.click.profile':
    'Profiling Views: Aggregate Flamegraph Click Profile',
  'profiling_views.flamegraph.click.highlight_frame':
    'Profiling Views: Aggregate Profile Click Highlight Frame',
  'profiling_views.aggregate_flamegraph.zoom.reset':
    'Profiling Views: Aggregate Flamegraph Zoom Reset',
  'profiling_views.aggregate_profile_flamegraph':
    'Profile Views: Aggregate Profile Flamegraph',
  'profiling_views.flamegraph.thread.change': 'Profiling Views: Flamegraph Thread Change',
  'profiling_views.flamegraph.zoom.reset': 'Profiling Views: Flamegraph Zoom Reset',
  'profiling_views.go_to_flamegraph': 'Profiling Views: Go to Flamegraph',
  'profiling_views.landing': 'Profiling Views: Landing',
  'profiling_views.landing.tab_change': 'Profiling Views: Landing Tab Change',
  'profiling_views.landing.tab.transaction_click':
    'Profiling Views: Landing Tab Transaction Click',
  'profiling_views.landing.widget_change': 'Profiling Views: Landing Widget Change',
  'profiling_views.landing.widget.function_change':
    'Profiling Views: Landing Widget Function Change',
  'profiling_views.landing.widget.open_list':
    'Profiling Views: Landing Widget Function Open List',
  'profiling_views.landing.widget.pagination':
    'Profiling Views: Landing Widget Pagination',
  'profiling_views.go_to_transaction': 'Profiling Views: Go to Transaction',

  'profiling_views.profile_flamegraph': 'Profiling Views: Flamegraph',
  'profiling_views.trace.profile_context.pagination':
    'Profiling Views: Trace Profile Context Pagination',
};
