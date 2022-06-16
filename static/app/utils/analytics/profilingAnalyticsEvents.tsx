type ProfilingPrefix = 'profiling';
type ProfilingViews =
  | 'landing'
  | 'profile_summary'
  | 'profile_details'
  | 'profile_flamegraph';

type EventKey = `${ProfilingPrefix}_views.${ProfilingViews}`;

export const profilingEventMap: Record<EventKey, string> = {
  'profiling_views.landing': 'Profiling Views: Landing',
  'profiling_views.profile_flamegraph': 'Profiling Views: Flamegraph',
  'profiling_views.profile_summary': 'Profiling Views: Profile Summary',
  'profiling_views.profile_details': 'Profiling Views: Profile Details',
};
