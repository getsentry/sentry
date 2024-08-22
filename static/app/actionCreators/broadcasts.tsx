import type {Client} from 'sentry/api';
import {queryClient} from 'sentry/queryClient';

export function getAllBroadcasts(api: Client, orgSlug: string) {
  const config = queryClient.ensureQueryData({
    queryKey: ['getAllBroadcasts'],
    queryFn: () =>
      api.requestPromise(`/organizations/${orgSlug}/broadcasts/`, {method: 'GET'}),
    gcTime: 1000 * 60 * 60,
  });
  return config;
}

export function markBroadcastsAsSeen(api: Client, idList: string[]) {
  return api.requestPromise('/broadcasts/', {
    method: 'PUT',
    query: {id: idList},
    data: {hasSeen: '1'},
  });
}
