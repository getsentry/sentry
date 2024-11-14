import {useCallback} from 'react';
import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import {browserHistory} from 'sentry/utils/browserHistory';
import {ISSUE_PROPERTY_FIELDS} from 'sentry/utils/fields';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useCleanQueryParamsOnRouteLeave from 'sentry/utils/useCleanQueryParamsOnRouteLeave';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {EventList} from 'sentry/views/issueDetails/streamline/eventList';
import {EventSearch} from 'sentry/views/issueDetails/streamline/eventSearch';
import {useGroup} from 'sentry/views/issueDetails/useGroup';
import {
  useEnvironmentsFromUrl,
  useHasStreamlinedUI,
} from 'sentry/views/issueDetails/utils';

import AllEventsTable from './allEventsTable';

export const ALL_EVENTS_EXCLUDED_TAGS = [
  'environment',
  'performance.issue_ids',
  'transaction.op',
  'transaction.status',
  ...ISSUE_PROPERTY_FIELDS,
];

interface GroupEventsProps {
  group: Group;
}

function GroupEvents({group}: GroupEventsProps) {
  const location = useLocation();
  const environments = useEnvironmentsFromUrl();
  const params = useParams<{groupId: string}>();
  const organization = useOrganization();

  useCleanQueryParamsOnRouteLeave({
    fieldsToClean: ['cursor', 'query'],
    shouldClean: newLocation =>
      newLocation.pathname.includes(`/issues/${params.groupId}/`),
  });

  const handleSearch = useCallback(
    (query: string) =>
      browserHistory.push(
        normalizeUrl({
          pathname: `/organizations/${organization.slug}/issues/${params.groupId}/events/`,
          query: {...location.query, query},
        })
      ),
    [location, organization, params.groupId]
  );

  const query = (location.query?.query ?? '') as string;

  return (
    <Layout.Body>
      <Layout.Main fullWidth>
        <AllEventsFilters>
          <EventSearch
            environments={environments}
            group={group}
            handleSearch={handleSearch}
            query={query}
          />
        </AllEventsFilters>
        <AllEventsTable
          organization={organization}
          group={group}
          excludedTags={ALL_EVENTS_EXCLUDED_TAGS}
        />
      </Layout.Main>
    </Layout.Body>
  );
}

const AllEventsFilters = styled('div')`
  margin-bottom: ${space(2)};
`;

// TODO(streamlined-ui): Remove this file completely and change rotue to new events list
function IssueEventsList() {
  const hasStreamlinedUI = useHasStreamlinedUI();
  const params = useParams<{groupId: string}>();
  const {
    data: group,
    isPending: isGroupPending,
    isError: isGroupError,
    refetch: refetchGroup,
  } = useGroup({groupId: params.groupId});

  if (isGroupPending) {
    return <LoadingIndicator />;
  }

  if (isGroupError) {
    return <LoadingError onRetry={refetchGroup} />;
  }

  if (hasStreamlinedUI) {
    return <EventList group={group} />;
  }

  return <GroupEvents group={group} />;
}

export default IssueEventsList;
