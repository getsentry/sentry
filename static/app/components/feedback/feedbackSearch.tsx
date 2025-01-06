import {useCallback, useMemo} from 'react';
import orderBy from 'lodash/orderBy';

import {fetchTagValues, useFetchOrganizationTags} from 'sentry/actionCreators/tags';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import type {FilterKeySection} from 'sentry/components/searchQueryBuilder/types';
import {t} from 'sentry/locale';
import type {Tag, TagCollection, TagValue} from 'sentry/types/group';
import {getUtcDateString} from 'sentry/utils/dates';
import {isAggregateField} from 'sentry/utils/discover/fields';
import {
  FEEDBACK_FIELDS,
  FeedbackFieldKey,
  FieldKey,
  FieldKind,
  getFieldDefinition,
} from 'sentry/utils/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';

const EXCLUDED_TAGS: string[] = [
  FeedbackFieldKey.BROWSER_VERSION,
  FeedbackFieldKey.EMAIL,
  FeedbackFieldKey.LOCALE_LANG,
  FeedbackFieldKey.LOCALE_TIMEZONE,
  FeedbackFieldKey.NAME,
  FieldKey.PLATFORM,
  FeedbackFieldKey.OS_VERSION,
  // These are found in issue platform and redundant (= __.name, ex os.name)
  'browser',
  'device',
  'os',
  'user',
];

const getFeedbackFieldDefinition = (key: string) => getFieldDefinition(key, 'feedback');

function fieldDefinitionsToTagCollection(fieldKeys: string[]): TagCollection {
  return Object.fromEntries(
    fieldKeys.map(key => [
      key,
      {
        key,
        name: key,
        ...getFeedbackFieldDefinition(key),
      },
    ])
  );
}

const FEEDBACK_FIELDS_AS_TAGS = fieldDefinitionsToTagCollection(FEEDBACK_FIELDS);

/**
 * Merges a list of supported tags and feedback search properties into one collection.
 */
function getFeedbackFilterKeys(supportedTags: TagCollection) {
  const allTags = {
    ...Object.fromEntries(
      Object.keys(supportedTags)
        .filter(key => !EXCLUDED_TAGS.includes(key))
        .map(key => [
          key,
          {
            ...supportedTags[key]!,
            kind: getFeedbackFieldDefinition(key)?.kind ?? FieldKind.TAG,
          },
        ])
    ),
    ...FEEDBACK_FIELDS_AS_TAGS,
  };

  // A hack used to "sort" the dictionary for SearchQueryBuilder.
  // Technically dicts are unordered but this works in dev.
  // To guarantee ordering, we need to implement filterKeySections.
  const keys = Object.keys(allTags);
  keys.sort();
  return Object.fromEntries(keys.map(key => [key, allTags[key]!]));
}

const getFilterKeySections = (tags: TagCollection): FilterKeySection[] => {
  const customTags: Tag[] = Object.values(tags).filter(
    tag =>
      tag.kind === FieldKind.TAG &&
      !EXCLUDED_TAGS.includes(tag.key) &&
      !FEEDBACK_FIELDS.map(String).includes(tag.key)
  );

  const orderedTagKeys: string[] = orderBy(
    customTags,
    ['totalValues', 'key'],
    ['desc', 'asc']
  ).map(tag => tag.key);

  return [
    {
      value: 'feedback_field',
      label: t('Suggested'),
      children: Object.keys(FEEDBACK_FIELDS_AS_TAGS),
    },
    {
      value: FieldKind.TAG,
      label: t('Tags'),
      children: orderedTagKeys,
    },
  ];
};

export default function FeedbackSearch() {
  const {selection: pageFilters} = usePageFilters();
  const projectIds = pageFilters.projects;
  const {pathname, query: locationQuery} = useLocation();
  const organization = useOrganization();
  const api = useApi();

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
      start,
      end,
      statsPeriod,
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
    () => getFeedbackFilterKeys(issuePlatformTags),
    [issuePlatformTags]
  );

  const filterKeySections = useMemo(() => {
    return getFilterKeySections(issuePlatformTags);
  }, [issuePlatformTags]);

  const getTagValues = useCallback(
    (tag: Tag, searchQuery: string): Promise<string[]> => {
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

      return fetchTagValues({
        api,
        orgSlug: organization.slug,
        tagKey: tag.key,
        search: searchQuery,
        projectIds: projectIds?.map(String),
        endpointParams,
      }).then(
        tagValues =>
          (tagValues as TagValue[])
            .filter(tagValue => tagValue.name !== '')
            .map(({value}) => value),
        () => {
          throw new Error('Unable to fetch event field values');
        }
      );
    },
    [api, organization.slug, projectIds, start, end, statsPeriod]
  );

  const navigate = useNavigate();

  const onSearch = useCallback(
    searchQuery => {
      navigate({
        pathname,
        query: {
          ...locationQuery,
          cursor: undefined,
          query: searchQuery.trim(),
        },
      });
    },
    [navigate, pathname, locationQuery]
  );

  return (
    <SearchQueryBuilder
      initialQuery={decodeScalar(locationQuery.query, '')}
      filterKeys={filterKeys}
      filterKeySections={filterKeySections}
      getTagValues={getTagValues}
      onSearch={onSearch}
      searchSource={'feedback-list'}
      placeholder={t('Search Feedback')}
      showUnsubmittedIndicator
    />
  );
}
