import React from 'react';

import {Client} from 'app/api';
import {t, tct} from 'app/locale';
import {Event, Group} from 'app/types';

/**
 * Fetches group data and mark as seen
 *
 * @param orgId organization slug
 * @param groupId groupId
 * @param eventId eventId or "latest" or "oldest"
 * @param envNames
 * @param projectId project slug required for eventId that is not latest or oldest
 */
export async function fetchGroupEvent(
  api: Client,
  orgId: string,
  groupId: string,
  eventId: string,
  envNames: string[],
  projectId?: string
): Promise<Event> {
  const url =
    eventId === 'latest' || eventId === 'oldest'
      ? `/issues/${groupId}/events/${eventId}/`
      : `/projects/${orgId}/${projectId}/events/${eventId}/`;

  const query: {environment?: string[]} = {};
  if (envNames.length !== 0) {
    query.environment = envNames;
  }

  const data = await api.requestPromise(url, {query});
  return data;
}

export function markEventSeen(
  api: Client,
  orgId: string,
  projectId: string,
  groupId: string
) {
  api.bulkUpdate(
    {
      orgId,
      projectId,
      itemIds: [groupId],
      failSilently: true,
      data: {hasSeen: true},
    },
    {}
  );
}

export function fetchGroupUserReports(groupId: string, query: Record<string, string>) {
  const api = new Client();

  return api.requestPromise(`/issues/${groupId}/user-reports/`, {
    includeAllArgs: true,
    query,
  });
}

/**
 * Returns the environment name for an event or null
 *
 * @param event
 */
export function getEventEnvironment(event: Event) {
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
 * @param group
 * @param removeLinks add/remove links to subscription reasons text (default: false)
 * @returns Reason for subscription
 */
export function getSubscriptionReason(group: Group, removeLinks = false) {
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

    if (reason && SUBSCRIPTION_REASONS.hasOwnProperty(reason)) {
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
