import type {PlainRoute} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useRoutes} from 'sentry/utils/useRoutes';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';

function getCurrentTab({
  routes,
  params,
}: {
  params: Record<string, string | undefined>;
  routes: PlainRoute[];
}) {
  const currentRoute = routes[routes.length - 1];

  // If we're in the tag details page ("/distributions/:tagKey/")
  if (params.tagKey) {
    return Tab.DISTRIBUTIONS;
  }
  return (
    Object.values(Tab).find(tab => currentRoute?.path === TabPaths[tab]) ?? Tab.DETAILS
  );
}

function getCurrentRouteInfo({
  groupId,
  eventId,
  organization,
  routes,
  params,
}: {
  eventId: string | undefined;
  groupId: string;
  organization: Organization;
  params: Record<string, string | undefined>;
  routes: PlainRoute[];
}): {
  baseUrl: string;
  currentTab: Tab;
} {
  const currentTab = getCurrentTab({routes, params});

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
  const params = useParams<{groupId: string; eventId?: string; tagKey?: string}>();
  const routes = useRoutes();
  return getCurrentRouteInfo({
    groupId: params.groupId,
    eventId: params.eventId,
    organization,
    routes,
    params,
  });
}
