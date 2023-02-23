import {PlatformKey} from 'sentry/data/platformCategories';

type ProfilingEventSource =
  | 'discover.transactions_table'
  | 'performance.missing_instrumentation'
  | 'performance.trace_view'
  | 'performance.transactions_summary.overview'
  | 'slowest_transaction_panel'
  | 'transaction_details'
  | 'transaction_hovercard.trigger'
  | 'transaction_hovercard.latest_profile'
  | 'transaction_hovercard.slowest_profile'
  | 'transaction_hovercard.suspect_function'
  | 'events.profile_event_context'
  | 'profiling_transaction.suspect_functions_table'
  | 'performance_transaction.suspect_functions_table'
  | 'discover.table';

interface EventPayloadWithProjectDetails {
  project_id: string | number | undefined;
  project_platform: PlatformKey | undefined;
}

export type ProfilingEventParameters = {
  // ui interactions
  'profiling_ui_events.transaction_hovercard_view': {};
  // views & nav
  'profiling_views.give_feedback_action': {};
  'profiling_views.go_to_flamegraph': {source: ProfilingEventSource};
  'profiling_views.go_to_transaction': {
    source: ProfilingEventSource;
  };
  'profiling_views.landing': {};
  'profiling_views.onboarding': {};
  'profiling_views.onboarding_action': {
    action: 'done' | 'dismissed';
  };
  'profiling_views.profile_details': EventPayloadWithProjectDetails;
  'profiling_views.profile_flamegraph': EventPayloadWithProjectDetails;
  'profiling_views.profile_summary': EventPayloadWithProjectDetails;
  'profiling_views.visit_discord_channel': {};
};

type EventKey = keyof ProfilingEventParameters;

export const profilingEventMap: Record<EventKey, string> = {
  'profiling_views.landing': 'Profiling Views: Landing',
  'profiling_views.onboarding': 'Profiling Views: Onboarding',
  'profiling_views.profile_flamegraph': 'Profiling Views: Flamegraph',
  'profiling_views.profile_summary': 'Profiling Views: Profile Summary',
  'profiling_views.profile_details': 'Profiling Views: Profile Details',
  'profiling_views.go_to_flamegraph': 'Profiling Views: Go to Flamegraph',
  'profiling_views.go_to_transaction': 'Profiling Views: Go to Transaction',
  'profiling_views.onboarding_action': 'Profiling Actions: Onboarding Action',
  'profiling_views.give_feedback_action': 'Profiling Actions: Feedback Action',
  'profiling_views.visit_discord_channel': 'Profiling Actions: Visit Discord Channel',
  'profiling_ui_events.transaction_hovercard_view':
    'Profiling Actions: Viewed Transaction Hovercard',
};
