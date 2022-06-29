export type ProfilingEventParameters = {
  'profiling_views.go_to_flamegraph': {source: string};
  'profiling_views.landing': {};
  'profiling_views.onboarding': {};
  'profiling_views.profile_details': {};
  'profiling_views.profile_flamegraph': {};
  'profiling_views.profile_summary': {};
};

type EventKey = keyof ProfilingEventParameters;

export const profilingEventMap: Record<EventKey, string> = {
  'profiling_views.landing': 'Profiling Views: Landing',
  'profiling_views.onboarding': 'Profiling Views: Onboarding',
  'profiling_views.profile_flamegraph': 'Profiling Views: Flamegraph',
  'profiling_views.profile_summary': 'Profiling Views: Profile Summary',
  'profiling_views.profile_details': 'Profiling Views: Profile Details',
  'profiling_views.go_to_flamegraph': 'Profiling Views: Go to Flamegraph',
};
