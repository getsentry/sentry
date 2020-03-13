import {Client} from 'app/api';

export function getAllBroadcasts(api: Client, orgSlug: string) {
  return api.requestPromise(`/organizations/${orgSlug}/broadcasts/`, {method: 'GET'});
}

export function markBroadcastsAsSeen(api: Client, idList: string[]) {
  return api.requestPromise('/broadcasts/', {
    method: 'PUT',
    query: {id: idList},
    data: {hasSeen: '1'},
  });
}
