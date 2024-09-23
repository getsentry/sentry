import {useCallback, useMemo} from 'react';
import orderBy from 'lodash/orderBy';

import {fetchTagValues, useFetchOrganizationTags} from 'sentry/actionCreators/tags';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import type {FilterKeySection} from 'sentry/components/searchQueryBuilder/types';
import SmartSearchBar from 'sentry/components/smartSearchBar';
import {MAX_QUERY_LENGTH, NEGATION_OPERATOR, SEARCH_WILDCARD} from 'sentry/constants';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Tag, TagCollection, TagValue} from 'sentry/types/group';
import {SavedSearchType} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getUtcDateString} from 'sentry/utils/dates';
import {isAggregateField} from 'sentry/utils/discover/fields';
import {
  FieldKind,
  getFieldDefinition,
  REPLAY_CLICK_FIELDS,
  REPLAY_FIELDS,
} from 'sentry/utils/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';

const SEARCH_SPECIAL_CHARS_REGEXP = new RegExp(
  `^${NEGATION_OPERATOR}|\\${SEARCH_WILDCARD}`,
  'g'
);

/**
 * Prepare query string (e.g. strip special characters like negation operator)
 */
function prepareQuery(searchQuery: string) {
  return searchQuery.replace(SEARCH_SPECIAL_CHARS_REGEXP, '');
}
const getReplayFieldDefinition = (key: string) => getFieldDefinition(key, 'replay');

function fieldDefinitionsToTagCollection(fieldKeys: string[]): TagCollection {
  return Object.fromEntries(
    fieldKeys.map(key => [
      key,
      {
        key,
        name: key,
        ...getReplayFieldDefinition(key),
      },
    ])
  );
}

const REPLAY_FIELDS_AS_TAGS = fieldDefinitionsToTagCollection(REPLAY_FIELDS);
const REPLAY_CLICK_FIELDS_AS_TAGS = fieldDefinitionsToTagCollection(REPLAY_CLICK_FIELDS);
/**
 * Excluded from the display but still valid search queries. browser.name,
 * device.name, etc are effectively the same and included from REPLAY_FIELDS.
 * Displaying these would be redundant and confusing.
 */
const EXCLUDED_TAGS = ['browser', 'device', 'os', 'user'];

/**
 * Merges a list of supported tags and replay search properties
 * (https://docs.sentry.io/concepts/search/searchable-properties/session-replay/)
 * into one collection.
 */
function getReplayFilterKeys(supportedTags: TagCollection): TagCollection {
  return {
    ...REPLAY_FIELDS_AS_TAGS,
    ...REPLAY_CLICK_FIELDS_AS_TAGS,
    ...Object.fromEntries(
      Object.keys(supportedTags)
        .filter(key => !EXCLUDED_TAGS.includes(key))
        .map(key => [
          key,
          {
            ...supportedTags[key],
            kind: getReplayFieldDefinition(key)?.kind ?? FieldKind.TAG,
          },
        ])
    ),
  };
}

const getFilterKeySections = (
  tags: TagCollection,
  organization: Organization
): FilterKeySection[] => {
  if (!organization.features.includes('search-query-builder-replays')) {
    return [];
  }

  const customTags: Tag[] = Object.values(tags).filter(
    tag =>
      !EXCLUDED_TAGS.includes(tag.key) &&
      !REPLAY_FIELDS.map(String).includes(tag.key) &&
      !REPLAY_CLICK_FIELDS.map(String).includes(tag.key)
  );

  const orderedTagKeys = orderBy(customTags, ['totalValues', 'key'], ['desc', 'asc']).map(
    tag => tag.key
  );

  return [
    {
      value: 'replay_field',
      label: t('Suggested'),
      children: Object.keys(REPLAY_FIELDS_AS_TAGS),
    },
    {
      value: 'replay_click_field',
      label: t('Click Fields'),
      children: Object.keys(REPLAY_CLICK_FIELDS_AS_TAGS),
    },
    {
      value: FieldKind.TAG,
      label: t('Tags'),
      children: orderedTagKeys,
    },
  ];
};

type Props = React.ComponentProps<typeof SmartSearchBar> & {
  organization: Organization;
  pageFilters: PageFilters;
};

function ReplaySearchBar(props: Props) {
  const {organization, pageFilters} = props;
  const api = useApi();
  const projectIds = pageFilters.projects;
  const start = pageFilters.datetime.start
    ? getUtcDateString(pageFilters.datetime.start)
    : undefined;
  const end = pageFilters.datetime.end
    ? getUtcDateString(pageFilters.datetime.end)
    : undefined;
  const statsPeriod = pageFilters.datetime.period;

  const tagQuery = useFetchOrganizationTags(
    {
      orgSlug: organization.slug,
      projectIds: projectIds.map(String),
      dataset: Dataset.ISSUE_PLATFORM,
      useCache: true,
      enabled: true,
      keepPreviousData: false,
      start: start,
      end: end,
      statsPeriod: statsPeriod,
    },
    {}
  );
  const issuePlatformTags: TagCollection = useMemo(() => {
    return (tagQuery.data ?? []).reduce<TagCollection>((acc, tag) => {
      acc[tag.key] = {...tag, kind: FieldKind.TAG};
      return acc;
    }, {});
  }, [tagQuery]);
  // tagQuery.isLoading and tagQuery.isError are not used

  const filterKeys = useMemo(
    () => getReplayFilterKeys(issuePlatformTags),
    [issuePlatformTags]
  );
  const filterKeySections = useMemo(() => {
    return getFilterKeySections(issuePlatformTags, organization);
  }, [issuePlatformTags, organization]);

  const getTagValues = useCallback(
    (tag: Tag, searchQuery: string): Promise<string[]> => {
      if (isAggregateField(tag.key)) {
        // We can't really auto suggest values for aggregate fields
        // or measurements, so we simply don't
        return Promise.resolve([]);
      }

      const endpointParams = {
        start: start,
        end: end,
        statsPeriod: statsPeriod,
      };

      return fetchTagValues({
        api,
        orgSlug: organization.slug,
        tagKey: tag.key,
        search: searchQuery,
        projectIds: projectIds?.map(String),
        endpointParams,
        includeReplays: true,
      }).then(
        tagValues => (tagValues as TagValue[]).map(({value}) => value),
        () => {
          throw new Error('Unable to fetch event field values');
        }
      );
    },
    [api, organization.slug, projectIds, start, end, statsPeriod]
  );

  const onSearch = props.onSearch;
  const onSearchWithAnalytics = useCallback(
    (query: string) => {
      onSearch?.(query);
      const conditions = new MutableSearch(query);
      const searchKeys = conditions.tokens.map(({key}) => key).filter(Boolean);

      if (searchKeys.length > 0) {
        trackAnalytics('replay.search', {
          search_keys: searchKeys.join(','),
          organization,
        });
      }
    },
    [onSearch, organization]
  );

  if (organization.features.includes('search-query-builder-replays')) {
    return (
      <SearchQueryBuilder
        {...props}
        onChange={undefined} // not implemented and different type from SmartSearchBar
        disallowLogicalOperators={undefined} // ^
        className={props.className}
        fieldDefinitionGetter={getReplayFieldDefinition}
        filterKeys={filterKeys}
        filterKeySections={filterKeySections}
        getTagValues={getTagValues}
        initialQuery={props.query ?? props.defaultQuery ?? ''}
        onSearch={onSearchWithAnalytics}
        searchSource={props.searchSource ?? 'replay_index'}
        placeholder={
          props.placeholder ??
          t('Search for users, duration, clicked elements, count_errors, and more')
        }
        recentSearches={SavedSearchType.REPLAY}
        showUnsubmittedIndicator
      />
    );
  }

  return (
    <SmartSearchBar
      {...props}
      onGetTagValues={getTagValues}
      supportedTags={filterKeys}
      placeholder={
        props.placeholder ??
        t('Search for users, duration, clicked elements, count_errors, and more')
      }
      prepareQuery={prepareQuery}
      maxQueryLength={MAX_QUERY_LENGTH}
      searchSource={props.searchSource ?? 'replay_index'}
      savedSearchType={SavedSearchType.REPLAY}
      maxMenuHeight={500}
      hasRecentSearches
      projectIds={projectIds}
      fieldDefinitionGetter={getReplayFieldDefinition}
      mergeSearchGroupWith={{
        click: {
          documentation: t('Search by click selector. (Requires SDK version >= 7.44.0)'),
        },
      }}
      onSearch={onSearchWithAnalytics}
    />
  );
}

export default ReplaySearchBar;
