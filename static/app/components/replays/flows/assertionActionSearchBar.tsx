import {useCallback, useMemo} from 'react';
import orderBy from 'lodash/orderBy';

import {fetchTagValues, useFetchOrganizationTags} from 'sentry/actionCreators/tags';
import type SmartSearchBar from 'sentry/components/deprecatedSmartSearchBar';
import {EMAIL_REGEX} from 'sentry/components/events/contexts/knownContext/user';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import type {FilterKeySection} from 'sentry/components/searchQueryBuilder/types';
import {t} from 'sentry/locale';
import type {Tag, TagCollection} from 'sentry/types/group';
import {SavedSearchType} from 'sentry/types/group';
import {isAggregateField} from 'sentry/utils/discover/fields';
import {
  FieldKind,
  getFieldDefinition,
  REPLAY_CLICK_FIELDS,
  REPLAY_FIELDS,
  REPLAY_TAG_ALIASES,
} from 'sentry/utils/fields';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';

interface Props extends React.ComponentProps<typeof SmartSearchBar> {
  onChange: (query: string) => void;
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

export default function AssertionActionSearchBar({projectIds, ...props}: Props) {
  const api = useApi();
  const organization = useOrganization();

  const tagQuery = useFetchOrganizationTags(
    {
      orgSlug: organization.slug,
      projectIds: projectIds?.map(String),
      dataset: Dataset.REPLAYS,
      useCache: true,
      enabled: true,
      keepPreviousData: false,
      statsPeriod: '90d',
    },
    {}
  );

  const customTags: TagCollection = useMemo(() => {
    return (tagQuery.data ?? []).reduce<TagCollection>((acc, tag) => {
      acc[tag.key] = {...tag, kind: FieldKind.TAG};
      return acc;
    }, {});
  }, [tagQuery]);

  const filterKeys = useMemo(() => getReplayFilterKeys(customTags), [customTags]);
  const filterKeySections = useMemo(() => getFilterKeySections(customTags), [customTags]);

  const getTagValues = useCallback(
    (tag: Tag, searchQuery: string): Promise<string[]> => {
      if (isAggregateField(tag.key)) {
        // We can't really auto suggest values for aggregate fields
        // or measurements, so we simply don't
        return Promise.resolve([]);
      }

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
        endpointParams: {
          statsPeriod: '90d',
        },
        includeReplays: true,
      }).then(
        tagValues =>
          tagValues.filter(tagValue => tagValue.name !== '').map(({value}) => value),
        () => {
          throw new Error('Unable to fetch event field values');
        }
      );
    },
    [api, organization.slug, projectIds]
  );

  return (
    <SearchQueryBuilder
      {...props}
      disallowLogicalOperators
      fieldDefinitionGetter={getReplayFieldDefinition}
      filterKeys={filterKeys}
      filterKeySections={filterKeySections}
      getTagValues={getTagValues}
      matchKeySuggestions={[{key: 'user.email', valuePattern: EMAIL_REGEX}]}
      initialQuery={props.query ?? props.defaultQuery ?? ''}
      searchSource={props.searchSource ?? 'replay_index'}
      placeholder={
        props.placeholder ??
        t('Search for users, duration, clicked elements, count_errors, and more')
      }
      recentSearches={SavedSearchType.REPLAY}
    />
  );
}
