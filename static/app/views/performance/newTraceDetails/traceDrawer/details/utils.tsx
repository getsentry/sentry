import type {EventTransaction} from 'sentry/types/event';

export function getProfileMeta(event: EventTransaction | null) {
  const profileId = event?.contexts?.profile?.profile_id;
  if (profileId) {
    return profileId;
  }
  const profilerId = event?.contexts?.profile?.profiler_id;
  if (profilerId) {
    const start = new Date(event.startTimestamp * 1000);
    const end = new Date(event.endTimestamp * 1000);
    return {
      profiler_id: profilerId,
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }
  return null;
}
