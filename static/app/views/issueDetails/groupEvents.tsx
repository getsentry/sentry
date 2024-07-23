import {useCallback, useMemo} from 'react';
import type {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import orderBy from 'lodash/orderBy';

import {useFetchIssueTags} from 'sentry/actionCreators/group';
import {fetchTagValues} from 'sentry/actionCreators/tags';
import EventSearchBar from 'sentry/components/events/searchBar';
import * as Layout from 'sentry/components/layouts/thirds';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import type {FilterKeySection} from 'sentry/components/searchQueryBuilder/types';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group, Tag, TagCollection} from 'sentry/types/group';
import {browserHistory} from 'sentry/utils/browserHistory';
import {FieldKind, ISSUE_EVENT_PROPERTY_FIELDS} from 'sentry/utils/fields';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useApi from 'sentry/utils/useApi';
import useCleanQueryParamsOnRouteLeave from 'sentry/utils/useCleanQueryParamsOnRouteLeave';
import useOrganization from 'sentry/utils/useOrganization';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {mergeAndSortTagValues} from 'sentry/views/issueDetails/utils';
import {makeGetIssueTagValues} from 'sentry/views/issueList/utils/getIssueTagValues';

import AllEventsTable from './allEventsTable';

interface Props extends RouteComponentProps<{groupId: string}, {}> {
  environments: string[];
  group: Group;
}

const EXCLUDED_TAGS = [
  'environment',
  'issue',
  'issue.id',
  'performance.issue_ids',
  'transaction.op',
  'transaction.status',
];

function getFilterKeySections(tags: TagCollection): FilterKeySection[] {
  const allTags: Tag[] = Object.values(tags).filter(
    tag => !EXCLUDED_TAGS.includes(tag.key)
  );
  const eventFields = orderBy(
    allTags.filter(tag => tag.kind === FieldKind.EVENT_FIELD),
    ['key']
  ).map(tag => tag.key);
  const eventTags = orderBy(
    allTags.filter(tag => tag.kind === FieldKind.TAG),
    ['totalValues', 'key'],
    ['desc', 'asc']
  ).map(tag => tag.key);

  return [
    {
      value: FieldKind.EVENT_FIELD,
      label: t('Event Filters'),
      children: eventFields,
    },
    {
      value: FieldKind.TAG,
      label: t('Event Tags'),
      children: eventTags,
    },
  ];
}

function UpdatedSearchBar({
  query,
  group,
  environments,
  handleSearch,
}: {
  environments: string[];
  group: Group;
  handleSearch: (value: string) => void;
  query: string;
}) {
  const api = useApi();
  const organization = useOrganization();

  const {data = []} = useFetchIssueTags({
    orgSlug: organization.slug,
    groupId: group.id,
    environment: environments,
  });

  const filterKeys = useMemo<TagCollection>(() => {
    const tags = [
      ...data.map(tag => ({...tag, kind: FieldKind.TAG})),
      ...ISSUE_EVENT_PROPERTY_FIELDS.map(tag => ({
        key: tag,
        name: tag,
        kind: FieldKind.EVENT_FIELD,
      })),
    ].filter(tag => !EXCLUDED_TAGS.includes(tag.key));

    return tags.reduce<TagCollection>((acc, tag) => {
      acc[tag.key] = tag;
      return acc;
    }, {});
  }, [data]);

  const tagValueLoader = useCallback(
    async (key: string, search: string) => {
      const orgSlug = organization.slug;
      const projectIds = [group.project.id];

      const [eventsDatasetValues, issuePlatformDatasetValues] = await Promise.all([
        fetchTagValues({
          api,
          orgSlug,
          tagKey: key,
          search,
          projectIds,
          dataset: Dataset.ERRORS,
        }),
        fetchTagValues({
          api,
          orgSlug,
          tagKey: key,
          search,
          projectIds,
          dataset: Dataset.ISSUE_PLATFORM,
        }),
      ]);

      return mergeAndSortTagValues(eventsDatasetValues, issuePlatformDatasetValues);
    },
    [api, group.project.id, organization.slug]
  );

  const getTagValues = useMemo(
    () => makeGetIssueTagValues(tagValueLoader),
    [tagValueLoader]
  );

  const filterKeySections = useMemo(() => getFilterKeySections(filterKeys), [filterKeys]);

  return (
    <SearchQueryBuilder
      initialQuery={query}
      onSearch={handleSearch}
      filterKeys={filterKeys}
      filterKeySections={filterKeySections}
      getTagValues={getTagValues}
      placeholder={t('Search events...')}
      searchSource="issue_events_tab"
    />
  );
}

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
            <UpdatedSearchBar
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
              excludedTags={EXCLUDED_TAGS}
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
          excludedTags={EXCLUDED_TAGS}
        />
      </Layout.Main>
    </Layout.Body>
  );
}

const AllEventsFilters = styled('div')`
  margin-bottom: ${space(2)};
`;

export default GroupEvents;
