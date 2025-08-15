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

interface EventPayloadWithProjectDetails {
  project_platform: PlatformKey | undefined;
}

type NoParams = Record<string, unknown>;

export type ProfilingEventParameters = {
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
  'profiling_views.profile_flamegraph': EventPayloadWithProjectDetails;
  'profiling_views.trace.profile_context.pagination': {
    direction: string;
  };
};

type EventKey = keyof ProfilingEventParameters;

export const profilingEventMap: Record<EventKey, string> = {
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
