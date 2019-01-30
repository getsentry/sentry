import {Client} from 'app/api';

/**
 * Fetches group data and mark as seen
 *
 * @param {String} orgId organization slug
 * @param {String} projectId project slug
 * @param {String} groupId groupId
 * @param {String} eventId eventId or "latest" or "oldest"
 * @returns {Promise<Object>}
 */
export function fetchGroupEventAndMarkSeen(orgId, projectId, groupId, eventId) {
  const api = new Client();

  const url =
    eventId === 'latest' || eventId === 'oldest'
      ? `/issues/${groupId}/events/${eventId}/`
      : `/projects/${orgId}/${projectId}/events/${eventId}/`;

  const promise = api.requestPromise(url);

  promise.then(data => {
    api.bulkUpdate({
      orgId,
      projectId,
      itemIds: [groupId],
      failSilently: true,
      data: {hasSeen: true},
    });
    return data;
  });

  return promise;
}

export function fetchGroupUserReports(groupId, query) {
  const api = new Client();

  return api.requestPromise(`/issues/${groupId}/user-reports/`, {
    includeAllArgs: true,
    query,
  });
}
