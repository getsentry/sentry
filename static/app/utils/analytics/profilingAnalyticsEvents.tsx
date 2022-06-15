type ProfilingPrefix = 'profiling';
type ProfilingViews =
  | 'landing'
  | 'transaction_summary'
  | 'profile_summary'
  | 'flamegraph';

type EventKey = `${ProfilingPrefix}_views.${ProfilingViews}`;

export const profilingEventMap: Record<EventKey, string> = {
  'profiling_views.landing': 'Profiling Views: Landing',
  'profiling_views.flamegraph': 'Profiling Views: Flamegraph',
  'profiling_views.transaction_summary': 'Profiling Views: Transaction Summary',
  'profiling_views.profile_summary': 'Profiling Views: Profile Summary',
};
