import {useCallback, useEffect, useMemo} from 'react';

import {fetchTagValues, loadOrganizationTags} from 'sentry/actionCreators/tags';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import type {FilterKeySection} from 'sentry/components/searchQueryBuilder/types';
import SmartSearchBar from 'sentry/components/smartSearchBar';
import {MAX_QUERY_LENGTH, NEGATION_OPERATOR, SEARCH_WILDCARD} from 'sentry/constants';
import {t} from 'sentry/locale';
import type {Organization, PageFilters, Tag, TagCollection, TagValue} from 'sentry/types';
import {SavedSearchType} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isAggregateField} from 'sentry/utils/discover/fields';
import type {FieldKey, ReplayClickFieldKey, ReplayFieldKey} from 'sentry/utils/fields';
import {
  FieldKind,
  getFieldDefinition,
  REPLAY_CLICK_FIELDS,
  REPLAY_FIELDS,
} from 'sentry/utils/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import useTags from 'sentry/utils/useTags';

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
 * Merges a list of supported tags and replay search fields into one collection.
 */
function getReplaySearchTags(supportedTags: TagCollection): TagCollection {
  return {
    ...Object.fromEntries(
      Object.keys(supportedTags).map(key => [
        key,
        {
          ...supportedTags[key],
          kind: getReplayFieldDefinition(key)?.kind ?? FieldKind.TAG,
        },
      ])
    ),
    ...REPLAY_CLICK_FIELDS_AS_TAGS,
    ...REPLAY_FIELDS_AS_TAGS,
  };
}

/**
 * Returns 3 sections: replay fields, replay click fields, and (filtered, non-field) tags.
 */
function getFilterKeySections(
  supportedTags: TagCollection,
  organization: Organization
): FilterKeySection[] {
  if (!organization.features.includes('search-query-builder-replays')) {
    return [];
  }

  const nonFieldTags: string[] = Object.values(supportedTags)
    .map(tag => tag.key)
    .filter(
      key =>
        !REPLAY_FIELDS.includes(key as ReplayFieldKey | FieldKey) &&
        !REPLAY_CLICK_FIELDS.includes(key as ReplayClickFieldKey)
    );
  nonFieldTags.sort();

  return [
    {
      value: 'replay_field',
      label: t('Replay Fields'),
      children: REPLAY_FIELDS,
    },
    {
      value: 'replay_click_field',
      label: t('Replay Click Fields'),
      children: REPLAY_CLICK_FIELDS,
    },
    {
      value: FieldKind.TAG,
      label: t('Tags'),
      children: nonFieldTags,
    },
  ];
}

type Props = React.ComponentProps<typeof SmartSearchBar> & {
  organization: Organization;
  pageFilters: PageFilters;
};

function ReplaySearchBar(props: Props) {
  const {organization, pageFilters} = props;
  const api = useApi();
  const projectIds = pageFilters.projects;
  const organizationTags = useTags();
  useEffect(() => {
    loadOrganizationTags(api, organization.slug, pageFilters);
  }, [api, organization.slug, pageFilters]);

  const replayTags = useMemo(
    () => getReplaySearchTags(organizationTags),
    [organizationTags]
  );
  const filterKeySections = useMemo(
    () => getFilterKeySections(organizationTags, organization),
    [organizationTags, organization]
  );

  const getTagValues = useCallback(
    (tag: Tag, searchQuery: string): Promise<string[]> => {
      if (isAggregateField(tag.key)) {
        // We can't really auto suggest values for aggregate fields
        // or measurements, so we simply don't
        return Promise.resolve([]);
      }

      return fetchTagValues({
        api,
        orgSlug: organization.slug,
        tagKey: tag.key,
        search: searchQuery,
        projectIds: projectIds?.map(String),
        includeReplays: true,
      }).then(
        tagValues => (tagValues as TagValue[]).map(({value}) => value),
        () => {
          throw new Error('Unable to fetch event field values');
        }
      );
    },
    [api, organization.slug, projectIds]
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
        filterKeys={replayTags}
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
      />
    );
  }

  return (
    <SmartSearchBar
      {...props}
      onGetTagValues={getTagValues}
      supportedTags={replayTags}
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
