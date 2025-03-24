import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useRouter from 'sentry/utils/useRouter';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';

type RouteProps = RouteComponentProps<{groupId: string; eventId?: string}>;

function getCurrentTab({router}: {router: RouteProps['router']}) {
  const currentRoute = router.routes[router.routes.length - 1];

  // If we're in the tag details page ("/tags/:tagKey/")
  if (router.params.tagKey) {
    return Tab.TAGS;
  }
  return (
    Object.values(Tab).find(tab => currentRoute?.path === TabPaths[tab]) ?? Tab.DETAILS
  );
}

function getCurrentRouteInfo({
  groupId,
  eventId,
  organization,
  router,
}: {
  eventId: string | undefined;
  groupId: string;
  organization: Organization;
  router: RouteProps['router'];
}): {
  baseUrl: string;
  currentTab: Tab;
} {
  const currentTab = getCurrentTab({router});

  const baseUrl = normalizeUrl(
    `/organizations/${organization.slug}/issues/${groupId}/${
      router.params.eventId && eventId ? `events/${eventId}/` : ''
    }`
  );

  return {baseUrl, currentTab};
}

export function useGroupDetailsRoute(): {
  baseUrl: string;
  currentTab: Tab;
} {
  const organization = useOrganization();
  const params = useParams<{groupId: string; eventId?: string}>();
  const router = useRouter();
  return getCurrentRouteInfo({
    groupId: params.groupId,
    eventId: params.eventId,
    organization,
    router,
  });
}
