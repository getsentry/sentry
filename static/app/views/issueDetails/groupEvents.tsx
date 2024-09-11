import {useCallback} from 'react';
import styled from '@emotion/styled';

import EventSearchBar from 'sentry/components/events/searchBar';
import * as Layout from 'sentry/components/layouts/thirds';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import {browserHistory} from 'sentry/utils/browserHistory';
import {ISSUE_PROPERTY_FIELDS} from 'sentry/utils/fields';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useCleanQueryParamsOnRouteLeave from 'sentry/utils/useCleanQueryParamsOnRouteLeave';
import useOrganization from 'sentry/utils/useOrganization';
import {EventSearch} from 'sentry/views/issueDetails/streamline/eventSearch';

import AllEventsTable from './allEventsTable';

interface Props extends RouteComponentProps<{groupId: string}, {}> {
  environments: string[];
  group: Group;
}

export const ALL_EVENTS_EXCLUDED_TAGS = [
  'environment',
  'performance.issue_ids',
  'transaction.op',
  'transaction.status',
  ...ISSUE_PROPERTY_FIELDS,
];

function GroupEvents({params, location, group, environments}: Props) {
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

  const query = location.query?.query ?? '';

  return (
    <Layout.Body>
      <Layout.Main fullWidth>
        <AllEventsFilters>
          {organization.features.includes('issue-stream-search-query-builder') ? (
            <EventSearch
              environments={environments}
              group={group}
              handleSearch={handleSearch}
              query={query}
            />
          ) : (
            <EventSearchBar
              organization={organization}
              defaultQuery=""
              onSearch={handleSearch}
              excludedTags={ALL_EVENTS_EXCLUDED_TAGS}
              query={query}
              hasRecentSearches={false}
              searchSource="issue_events_tab"
            />
          )}
        </AllEventsFilters>
        <AllEventsTable
          issueId={group.id}
          location={location}
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

export default GroupEvents;
