import type {Client} from 'sentry/api';

export function markBroadcastsAsSeen(api: Client, idList: string[]) {
  return api.requestPromise('/broadcasts/', {
    method: 'PUT',
    query: {id: idList},
    data: {hasSeen: '1'},
  });
}
