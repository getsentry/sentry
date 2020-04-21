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
export async function fetchGroupEventAndMarkSeen(
  api,
  orgId,
  projectId,
  groupId,
  eventId,
  envNames
) {
  const url =
    eventId === 'latest' || eventId === 'oldest'
      ? `/issues/${groupId}/events/${eventId}/`
      : `/projects/${orgId}/${projectId}/events/${eventId}/`;

  const query = {};
  if (envNames.length !== 0) {
    query.environment = envNames;
  }

  try {
    const data = await api.requestPromise(url, {query});
    api.bulkUpdate({
      orgId,
      projectId,
      itemIds: [groupId],
      failSilently: true,
      data: {hasSeen: true},
    });
    return data;
  } catch (err) {
    throw err;
  }
}

export function fetchGroupUserReports(groupId, query) {
  const api = new Client();

  return api.requestPromise(`/issues/${groupId}/user-reports/`, {
    includeAllArgs: true,
    query,
  });
}

/**
 * Returns the environment name for an event or null
 *
 * @param {Object} event
 * @returns {String|Void}
 */
export function getEventEnvironment(event) {
  const tag = event.tags.find(({key}) => key === 'environment');

  return tag ? tag.value : null;
}
