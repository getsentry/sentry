import {useCallback, useMemo} from 'react';
import orderBy from 'lodash/orderBy';

import {fetchFeatureFlagValues, fetchTagValues} from 'sentry/actionCreators/tags';
import {
  SearchQueryBuilder,
  type SearchQueryBuilderProps,
} from 'sentry/components/searchQueryBuilder';
import type {FilterKeySection} from 'sentry/components/searchQueryBuilder/types';
import {t} from 'sentry/locale';
import {
  SavedSearchType,
  type Tag,
  type TagCollection,
  type TagValue,
} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {getUtcDateString} from 'sentry/utils/dates';
import {FieldKind} from 'sentry/utils/fields';
import useApi from 'sentry/utils/useApi';
import usePageFilters from 'sentry/utils/usePageFilters';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {mergeAndSortTagValues} from 'sentry/views/issueDetails/utils';
import {makeGetIssueTagValues} from 'sentry/views/issueList/utils/getIssueTagValues';
import {useIssueListFilterKeys} from 'sentry/views/issueList/utils/useIssueListFilterKeys';

const getFilterKeySections = (
  tags: TagCollection,
  organization: Organization
): FilterKeySection[] => {
  const allTags: Tag[] = Object.values(tags).filter(
    tag => !EXCLUDED_TAGS.includes(tag.key)
  );

  const issueFields = orderBy(
    allTags.filter(tag => tag.kind === FieldKind.ISSUE_FIELD),
    ['key']
  ).map(tag => tag.key);

  const eventFields = orderBy(
    allTags.filter(tag => tag.kind === FieldKind.EVENT_FIELD),
    ['key']
  ).map(tag => tag.key);

  const eventTags = orderBy(
    allTags.filter(tag => tag.kind === FieldKind.TAG),
    ['totalValues', 'key'],
    ['desc', 'asc']
  ).map(tag => tag.key);

  const eventFeatureFlags = orderBy(
    allTags.filter(tag => tag.kind === FieldKind.FEATURE_FLAG),
    ['totalValues', 'key'],
    ['desc', 'asc']
  ).map(tag => tag.key);

  const sections = [
    {
      value: FieldKind.ISSUE_FIELD,
      label: t('Issues'),
      children: issueFields,
    },
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

  if (organization.features.includes('feature-flag-autocomplete')) {
    sections.push({
      value: FieldKind.FEATURE_FLAG,
      label: t('Flags'), // Keeping this short so the tabs stay on 1 line.
      children: eventFeatureFlags,
    });
  }

  return sections;
};

interface Props extends Partial<SearchQueryBuilderProps> {
  organization: Organization;
}

const EXCLUDED_TAGS = ['environment'];

function IssueListSearchBar({
  organization,
  searchSource = 'issues',
  initialQuery = '',
  ...props
}: Props) {
  const api = useApi();
  const {selection: pageFilters} = usePageFilters();
  const filterKeys = useIssueListFilterKeys();

  // Fetches the unique values seen for a tag key and query string. Result is sorted by count.
  const tagValueLoader = useCallback(
    async (key: string, search: string): Promise<TagValue[]> => {
      const projectIds = pageFilters.projects.map(id => id.toString());
      const endpointParams = {
        start: pageFilters.datetime.start
          ? getUtcDateString(pageFilters.datetime.start)
          : undefined,
        end: pageFilters.datetime.end
          ? getUtcDateString(pageFilters.datetime.end)
          : undefined,
        statsPeriod: pageFilters.datetime.period,
      };

      const fetchTagValuesPayload = {
        api,
        orgSlug: organization.slug,
        tagKey: key,
        search,
        projectIds,
        endpointParams,
        sort: '-count' as const,
      };

      // For now feature flags are treated like tags, but the api query is slightly different.
      if (filterKeys[key]?.kind === FieldKind.FEATURE_FLAG) {
        return await fetchFeatureFlagValues({
          ...fetchTagValuesPayload,
          organization,
        });
      }

      const [eventsDatasetValues, issuePlatformDatasetValues] = await Promise.all([
        fetchTagValues({
          ...fetchTagValuesPayload,
          dataset: Dataset.ERRORS,
        }),
        fetchTagValues({
          ...fetchTagValuesPayload,
          dataset: Dataset.ISSUE_PLATFORM,
        }),
      ]);

      return mergeAndSortTagValues(
        eventsDatasetValues,
        issuePlatformDatasetValues,
        'count'
      );
    },
    [
      api,
      filterKeys,
      organization,
      pageFilters.datetime.end,
      pageFilters.datetime.period,
      pageFilters.datetime.start,
      pageFilters.projects,
    ]
  );

  const getTagValues = useMemo(
    () => makeGetIssueTagValues(tagValueLoader),
    [tagValueLoader]
  );

  const filterKeySections = useMemo(() => {
    return getFilterKeySections(filterKeys, organization);
  }, [filterKeys, organization]);

  return (
    <SearchQueryBuilder
      initialQuery={initialQuery}
      getTagValues={getTagValues}
      filterKeySections={filterKeySections}
      filterKeys={filterKeys}
      recentSearches={SavedSearchType.ISSUE}
      disallowLogicalOperators
      showUnsubmittedIndicator
      searchSource={searchSource}
      {...props}
    />
  );
}

export default IssueListSearchBar;
