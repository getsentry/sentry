import {useCallback, useMemo} from 'react';
import orderBy from 'lodash/orderBy';

import {fetchTagValues, useFetchOrganizationTags} from 'sentry/actionCreators/tags';
import {EMAIL_REGEX} from 'sentry/components/events/contexts/knownContext/user';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import type {FilterKeySection} from 'sentry/components/searchQueryBuilder/types';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Tag, TagCollection} from 'sentry/types/group';
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
  REPLAY_TAG_ALIASES,
  REPLAY_TAP_FIELDS,
} from 'sentry/utils/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import type {GetTagValues} from 'sentry/views/dashboards/datasetConfig/base';

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
const REPLAY_TAP_FIELDS_AS_TAGS = fieldDefinitionsToTagCollection(REPLAY_TAP_FIELDS);
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
    ...REPLAY_TAP_FIELDS_AS_TAGS,
    ...Object.fromEntries(
      Object.keys(supportedTags)
        .filter(key => !EXCLUDED_TAGS.includes(key))
        .map(key => [
          key,
          {
            ...supportedTags[key]!,
            kind: getReplayFieldDefinition(key)?.kind ?? FieldKind.TAG,
          },
        ])
    ),
  };
}

const getFilterKeySections = (tags: TagCollection): FilterKeySection[] => {
  const customTags: Tag[] = Object.values(tags).filter(
    tag =>
      !EXCLUDED_TAGS.includes(tag.key) &&
      !REPLAY_FIELDS.map(String).includes(tag.key) &&
      !REPLAY_CLICK_FIELDS.map(String).includes(tag.key) &&
      !REPLAY_TAP_FIELDS.map(String).includes(tag.key)
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
      value: 'replay_tap_field',
      label: t('Tap Fields'),
      children: Object.keys(REPLAY_TAP_FIELDS_AS_TAGS),
    },
    {
      value: FieldKind.TAG,
      label: t('Tags'),
      children: orderedTagKeys,
    },
  ];
};

type Props = Omit<
  React.ComponentProps<typeof SearchQueryBuilder>,
  'filterKeys' | 'getTagValues' | 'searchSource' | 'onSearch'
> & {
  organization: Organization;
  pageFilters: PageFilters;
  query: string;
  onSearch?: (query: string) => void;
  searchSource?: string;
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
      dataset: Dataset.REPLAYS,
      useCache: true,
      enabled: true,
      keepPreviousData: false,
      start,
      end,
      statsPeriod,
    },
    {}
  );
  const customTags: TagCollection = useMemo(() => {
    return (tagQuery.data ?? []).reduce<TagCollection>((acc, tag) => {
      acc[tag.key] = {...tag, kind: FieldKind.TAG};
      return acc;
    }, {});
  }, [tagQuery]);
  // tagQuery.isLoading and tagQuery.isError are not used

  const filterKeys = useMemo(() => getReplayFilterKeys(customTags), [customTags]);
  const filterKeySections = useMemo(() => {
    return getFilterKeySections(customTags);
  }, [customTags]);

  const getTagValues = useCallback<GetTagValues>(
    (tag, searchQuery) => {
      if (isAggregateField(tag.key)) {
        // We can't really auto suggest values for aggregate fields
        // or measurements, so we simply don't
        return Promise.resolve([]);
      }

      const endpointParams = {
        start,
        end,
        statsPeriod,
      };

      const searchName =
        tag.key in REPLAY_TAG_ALIASES
          ? REPLAY_TAG_ALIASES[tag.key as keyof typeof REPLAY_TAG_ALIASES]
          : tag.key;

      return fetchTagValues({
        api,
        orgSlug: organization.slug,
        tagKey: searchName,
        search: searchQuery,
        projectIds: projectIds?.map(String),
        endpointParams,
        includeReplays: true,
      }).then(
        tagValues =>
          tagValues.filter(tagValue => tagValue.name !== '').map(({value}) => value),
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
      matchKeySuggestions={[{key: 'user.email', valuePattern: EMAIL_REGEX}]}
      initialQuery={props.query ?? props.initialQuery ?? ''}
      onSearch={onSearchWithAnalytics}
      searchSource={props.searchSource ?? 'replay_index'}
      placeholder={
        props.placeholder ??
        t('Search for users, duration, clicked elements, count_errors, and more')
      }
      recentSearches={SavedSearchType.REPLAY}
    />
  );
}

export default ReplaySearchBar;
