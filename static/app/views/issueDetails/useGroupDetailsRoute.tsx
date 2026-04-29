import {useMatches, type UIMatch} from 'react-router-dom';

import type {Organization} from 'sentry/types/organization';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';

function getCurrentTab({
  matches,
  params,
}: {
  matches: Array<UIMatch<unknown, unknown>>;
  params: Record<string, string | undefined>;
}) {
  const currentMatch = matches[matches.length - 1];
  const currentPath = (currentMatch?.handle as {path?: string} | undefined)?.path;

  // If we're in the tag details page ("/distributions/:tagKey/")
  if (params.tagKey) {
    return Tab.DISTRIBUTIONS;
  }
  return Object.values(Tab).find(tab => currentPath === TabPaths[tab]) ?? Tab.DETAILS;
}

function getCurrentRouteInfo({
  eventId,
  groupId,
  matches,
  organization,
  params,
}: {
  eventId: string | undefined;
  groupId: string;
  matches: Array<UIMatch<unknown, unknown>>;
  organization: Organization;
  params: Record<string, string | undefined>;
}): {
  baseUrl: string;
  currentTab: Tab;
} {
  const currentTab = getCurrentTab({matches, params});

  const baseUrl = normalizeUrl(
    `/organizations/${organization.slug}/issues/${groupId}/${
      params.eventId && eventId ? `events/${eventId}/` : ''
    }`
  );

  return {baseUrl, currentTab};
}

export function useGroupDetailsRoute(): {
  baseUrl: string;
  currentTab: Tab;
} {
  const organization = useOrganization();
  const params = useParams<{
    groupId: string;
    eventId?: string;
    tagKey?: string;
  }>();
  const matches = useMatches();
  return getCurrentRouteInfo({
    eventId: params.eventId,
    groupId: params.groupId,
    matches,
    organization,
    params,
  });
}
