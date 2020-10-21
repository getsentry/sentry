import {t, tct} from 'app/locale';
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

const SUBSCRIPTION_REASONS = {
  commented: t(
    "You're receiving workflow notifications because you have commented on this issue."
  ),
  assigned: t(
    "You're receiving workflow notifications because you were assigned to this issue."
  ),
  bookmarked: t(
    "You're receiving workflow notifications because you have bookmarked this issue."
  ),
  changed_status: t(
    "You're receiving workflow notifications because you have changed the status of this issue."
  ),
  mentioned: t(
    "You're receiving workflow notifications because you have been mentioned in this issue."
  ),
};

/**
 * @param {object} group
 * @param {boolean} removeLinks add/remove links to subscription reasons text (default: false)
 * @returns Reason for subscription
 */
export function getSubscriptionReason(group, removeLinks = false) {
  if (group.subscriptionDetails && group.subscriptionDetails.disabled) {
    return tct('You have [link:disabled workflow notifications] for this project.', {
      link: removeLinks ? <span /> : <a href="/account/settings/notifications/" />,
    });
  }

  if (!group.isSubscribed) {
    return t('Subscribe to workflow notifications for this issue');
  }

  if (group.subscriptionDetails) {
    const {reason} = group.subscriptionDetails;
    if (reason === 'unknown') {
      return t(
        "You're receiving workflow notifications because you are subscribed to this issue."
      );
    }

    if (SUBSCRIPTION_REASONS.hasOwnProperty(reason)) {
      return SUBSCRIPTION_REASONS[reason];
    }
  }

  return tct(
    "You're receiving updates because you are [link:subscribed to workflow notifications] for this project.",
    {
      link: removeLinks ? <span /> : <a href="/account/settings/notifications/" />,
    }
  );
}
