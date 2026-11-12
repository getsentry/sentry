import {Navigate, useMatches} from 'react-router';

import {legacyLocationDescriptorToTo} from 'sentry/router/legacy/location';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

import {
  loadIssueDetailsQueryParams,
  makeIssueDetailsLocation,
  type IssueDetailsPageTab,
} from './issueDetailsQueryParams';

/**
 * The route `handle` for a legacy path, naming the page tab its last segment
 * opened.
 */
interface LegacyIssueDetailsRouteHandle {
  legacyIssueDetailsTab: IssueDetailsPageTab;
}

/**
 * Redirects a path-based issue details URL, such as
 * `/issues/1/events/abc/replays/`, to its query-param form,
 * `/issues/1/?eventId=abc&tab=replays`. The query and hash carry over.
 */
export default function LegacyIssueDetailsRedirect() {
  const organization = useOrganization({allowNull: true});
  const params = useParams<{groupId: string; eventId?: string; orgId?: string}>();
  const location = useLocation();
  const matches = useMatches();
  const handle = matches[matches.length - 1]?.handle as
    | Partial<LegacyIssueDetailsRouteHandle>
    | undefined;

  const current = loadIssueDetailsQueryParams(location.query);
  const target = makeIssueDetailsLocation({
    organization: {slug: params.orgId ?? organization?.slug ?? ''},
    groupId: params.groupId,
    tab: handle?.legacyIssueDetailsTab ?? current.tab,
    eventId: params.eventId ?? current.eventId,
    drawer: current.drawer,
    query: location.query,
  });

  return (
    <Navigate
      replace
      to={legacyLocationDescriptorToTo({...target, hash: location.hash})}
    />
  );
}
