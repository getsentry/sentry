import {useCallback, useMemo} from 'react';
import orderBy from 'lodash/orderBy';
import union from 'lodash/union';

import {fetchTagValues, useFetchOrganizationTags} from 'sentry/actionCreators/tags';
import {EMAIL_REGEX} from 'sentry/components/events/contexts/knownContext/user';
import type {SearchGroup} from 'sentry/components/searchBar/types';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import type {GetTagValues} from 'sentry/components/searchQueryBuilder';
import type {FilterKeySection} from 'sentry/components/searchQueryBuilder/types';
import {t} from 'sentry/locale';
import type {Tag, TagCollection} from 'sentry/types/group';
import {getUtcDateString} from 'sentry/utils/dates';
import {isAggregateField} from 'sentry/utils/discover/fields';
import {
  FEEDBACK_FIELDS,
  FeedbackFieldKey,
  FieldKey,
  FieldKind,
  getFieldDefinition,
  IsFieldValues,
} from 'sentry/utils/fields';
import useAssignedSearchValues from 'sentry/utils/membersAndTeams/useAssignedSearchValues';
import {decodeScalar} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';

const EXCLUDED_TAGS: string[] = [
  // These are found in issue platform and redundant (= __.name, ex os.name)
  'browser',
  'device',
  'os',
  'user',
  FieldKey.PLATFORM,
  'ai_categorization.label.0',
  'ai_categorization.label.1',
  'ai_categorization.label.2',
  'ai_categorization.label.3',
  'ai_categorization.label.4',
  'ai_categorization.label.5',
  'ai_categorization.label.6',
  'ai_categorization.label.7',
  'ai_categorization.label.8',
  'ai_categorization.label.9',
  'ai_categorization.label.10',
  'ai_categorization.label.11',
  'ai_categorization.label.12',
  'ai_categorization.label.13',
  'ai_categorization.label.14',
  'ai_categorization.label.15',
];

const NON_TAG_FIELDS: string[] = [
  FieldKey.ASSIGNED,
  FieldKey.HAS,
  FieldKey.IS,
  FieldKey.MESSAGE,
];

const getFeedbackFieldDefinition = (key: string) => getFieldDefinition(key, 'feedback');

function getHasFieldValues(supportedTags: TagCollection): string[] {
  const customTagKeys = Object.values(supportedTags)
    .map(tag => tag.key)
    .filter(key => !EXCLUDED_TAGS.includes(key));

  // Ensure suggested fields are included.
  const feedbackFieldKeys = FEEDBACK_FIELDS.map(String).filter(
    key => !NON_TAG_FIELDS.includes(key)
  );

  return union(customTagKeys, feedbackFieldKeys).sort();
}

/**
 * Get the full collection of feedback search properties and custom tags.
 */
function getFeedbackFilterKeys(
  supportedTags: TagCollection,
  assignedValues: SearchGroup[] | string[]
) {
  const allTags = {
    ...Object.fromEntries(
      Object.keys(supportedTags)
        .filter(key => !EXCLUDED_TAGS.includes(key))
        .map(key => [
          key,
          {
            ...supportedTags[key]!,
            kind: FieldKind.TAG,
          },
        ])
    ),
    ...Object.fromEntries(
      FEEDBACK_FIELDS.map(key => {
        const fieldDefinition = getFeedbackFieldDefinition(key);

        if (key === FieldKey.ASSIGNED) {
          return [
            key,
            {
              key,
              name: key,
              ...fieldDefinition,
              predefined: true,
              values: assignedValues,
            },
          ];
        }

        if (key === FieldKey.HAS) {
          return [
            key,
            {
              key,
              name: key,
              ...fieldDefinition,
              predefined: true,
              values: getHasFieldValues(supportedTags),
            },
          ];
        }

        if (key === FieldKey.IS) {
          return [
            key,
            {
              key,
              name: key,
              ...fieldDefinition,
              predefined: true,
              values: Object.values(IsFieldValues),
            },
          ];
        }

        if (key === FeedbackFieldKey.MESSAGE) {
          return [
            key,
            {
              key,
              name: key,
              ...fieldDefinition,
              predefined: true,
              values: [], // message tag suggestions are not relevant to user feedback.
            },
          ];
        }

        return [
          key,
          {
            key,
            name: key,
            ...fieldDefinition,
          },
        ];
      })
    ),
  };

  // A hack used to "sort" the dictionary for SearchQueryBuilder.
  // Technically dicts are unordered but this seems to work.
  // To guarantee ordering, we need to implement filterKeySections.
  const keys = Object.keys(allTags).sort();
  return Object.fromEntries(keys.map(key => [key, allTags[key]!]));
}

const getFilterKeySections = (tags: TagCollection): FilterKeySection[] => {
  const customTags: Tag[] = Object.values(tags).filter(
    tag =>
      tag.kind === FieldKind.TAG &&
      !EXCLUDED_TAGS.includes(tag.key) &&
      !(FEEDBACK_FIELDS as string[]).includes(tag.key) // Sections can't overlap.
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
      children: FEEDBACK_FIELDS,
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

  const assignedValues = useAssignedSearchValues();

  const filterKeys = useMemo(
    () => getFeedbackFilterKeys(issuePlatformTags, assignedValues),
    [issuePlatformTags, assignedValues]
  );

  const filterKeySections = useMemo(() => {
    return getFilterKeySections(issuePlatformTags);
  }, [issuePlatformTags]);

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

      return fetchTagValues({
        api,
        orgSlug: organization.slug,
        tagKey: tag.key,
        search: searchQuery,
        projectIds: projectIds?.map(String),
        endpointParams,
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

  const navigate = useNavigate();

  const onSearch = useCallback(
    (searchQuery: any) => {
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
      fieldDefinitionGetter={getFeedbackFieldDefinition}
      filterKeys={filterKeys}
      filterKeySections={filterKeySections}
      getTagValues={getTagValues}
      onSearch={onSearch}
      searchSource="feedback-list"
      placeholder={t('Search Feedback')}
      matchKeySuggestions={[{key: 'user.email', valuePattern: EMAIL_REGEX}]}
    />
  );
}
