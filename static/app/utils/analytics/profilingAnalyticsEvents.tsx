type ProfilingPrefix = 'profiling';
type ProfilingViews =
  | 'landing'
  | 'transaction_summary'
  | 'profile_summary'
  | 'flamegraph';

type EventKey = `${ProfilingPrefix}_views.${ProfilingViews}`;

export const profilingEventMap: Record<EventKey, string> = {
  'profiling_views.landing': 'Profiling views: Landing',
  'profiling_views.flamegraph': 'Profiling views: Flamegraph',
  'profiling_views.transaction_summary': 'Profiling views: Transaction Summary',
  'profiling_views.profile_summary': 'Profiling views: Profile Summary',
};
