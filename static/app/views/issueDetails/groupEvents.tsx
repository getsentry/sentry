import {useCallback} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import EventSearchBar from 'sentry/components/events/searchBar';
import * as Layout from 'sentry/components/layouts/thirds';
import {space} from 'sentry/styles/space';
import {Group} from 'sentry/types';
import useCleanQueryParamsOnRouteLeave from 'sentry/utils/useCleanQueryParamsOnRouteLeave';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

import AllEventsTable from './allEventsTable';

interface Props extends RouteComponentProps<{groupId: string}, {}> {
  group: Group;
}

const excludedTags = [
  'environment',
  'issue',
  'issue.id',
  'performance.issue_ids',
  'transaction.op',
  'transaction.status',
];

function GroupEvents({params, location, group}: Props) {
  const organization = useOrganization();

  const {groupId} = params;

  useCleanQueryParamsOnRouteLeave({
    fieldsToClean: ['cursor', 'query'],
    shouldClean: newLocation => newLocation.pathname.includes(`/issues/${group.id}/`),
  });

  const handleSearch = useCallback(
    (query: string) =>
      browserHistory.push(
        normalizeUrl({
          pathname: `/organizations/${organization.slug}/issues/${groupId}/events/`,
          query: {...location.query, query},
        })
      ),
    [location, organization, groupId]
  );

  return (
    <Layout.Body>
      <Layout.Main fullWidth>
        <AllEventsFilters>
          <EventSearchBar
            organization={organization}
            defaultQuery=""
            onSearch={handleSearch}
            excludedTags={excludedTags}
            query={location.query?.query ?? ''}
            hasRecentSearches={false}
          />
        </AllEventsFilters>
        <AllEventsTable
          issueId={group.id}
          location={location}
          organization={organization}
          group={group}
          excludedTags={excludedTags}
        />
      </Layout.Main>
    </Layout.Body>
  );
}

const AllEventsFilters = styled('div')`
  margin-bottom: ${space(2)};
`;

export default GroupEvents;
