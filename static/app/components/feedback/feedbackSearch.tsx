import type {CSSProperties} from 'react';
import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {fetchTagValues} from 'sentry/actionCreators/tags';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import SmartSearchBar from 'sentry/components/smartSearchBar';
import {t} from 'sentry/locale';
import type {Tag, TagCollection, TagValue} from 'sentry/types';
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
import useFetchDatasetTags from 'sentry/utils/replays/hooks/useFetchDatasetTags';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';

const EXCLUDED_TAGS = [
  FeedbackFieldKey.BROWSER_VERSION,
  FeedbackFieldKey.EMAIL,
  FeedbackFieldKey.LOCALE_LANG,
  FeedbackFieldKey.LOCALE_TIMEZONE,
  FeedbackFieldKey.NAME,
  FieldKey.PLATFORM,
  FeedbackFieldKey.OS_VERSION,
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
 * Merges a list of supported tags and feedback search fields into one collection.
 */
function getFeedbackSearchTags(supportedTags: TagCollection) {
  const allTags = {
    ...Object.fromEntries(
      Object.keys(supportedTags).map(key => [
        key,
        {
          ...supportedTags[key],
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
  return Object.fromEntries(keys.map(key => [key, allTags[key]]));
}

interface Props {
  className?: string;
  style?: CSSProperties;
}

export default function FeedbackSearch({className, style}: Props) {
  const {selection: pageFilters} = usePageFilters();
  const projectIds = pageFilters.projects;
  const {pathname, query} = useLocation();
  const organization = useOrganization();
  const {tags: issuePlatformTags} = useFetchDatasetTags({
    org: organization,
    projectIds: projectIds.map(String),
    dataset: Dataset.ISSUE_PLATFORM,
    start: pageFilters.datetime.start
      ? getUtcDateString(pageFilters.datetime.start)
      : undefined,
    end: pageFilters.datetime.end
      ? getUtcDateString(pageFilters.datetime.end)
      : undefined,
    statsPeriod: pageFilters.datetime.period,
  });
  const api = useApi();

  const feedbackTags = useMemo(
    () => getFeedbackSearchTags(issuePlatformTags),
    [issuePlatformTags]
  );

  const getTagValues = useCallback(
    (tag: Tag, searchQuery: string): Promise<string[]> => {
      if (isAggregateField(tag.key)) {
        // We can't really auto suggest values for aggregate fields
        // or measurements, so we simply don't
        return Promise.resolve([]);
      }

      const endpointParams = {
        start: pageFilters.datetime.start
          ? getUtcDateString(pageFilters.datetime.start)
          : undefined,
        end: pageFilters.datetime.end
          ? getUtcDateString(pageFilters.datetime.end)
          : undefined,
        statsPeriod: pageFilters.datetime.period,
      };

      return fetchTagValues({
        api,
        orgSlug: organization.slug,
        tagKey: tag.key,
        search: searchQuery,
        projectIds: projectIds?.map(String),
        endpointParams,
      }).then(
        tagValues => (tagValues as TagValue[]).map(({value}) => value),
        () => {
          throw new Error('Unable to fetch event field values');
        }
      );
    },
    [
      api,
      organization.slug,
      projectIds,
      pageFilters.datetime.start,
      pageFilters.datetime.end,
      pageFilters.datetime.period,
    ]
  );

  const navigate = useNavigate();

  const onSearch = useCallback(
    searchQuery => {
      navigate({
        pathname,
        query: {
          ...query,
          cursor: undefined,
          query: searchQuery.trim(),
        },
      });
    },
    [navigate, pathname, query]
  );

  if (organization.features.includes('search-query-builder-user-feedback')) {
    return (
      <SearchQueryBuilder
        initialQuery={decodeScalar(query.query, '')}
        filterKeys={feedbackTags}
        getTagValues={getTagValues}
        onSearch={onSearch}
        searchSource={'feedback-list'}
        placeholder={t('Search Feedback')}
      />
    );
  }

  return (
    <SearchContainer className={className} style={style}>
      <SmartSearchBar
        hasRecentSearches
        projectIds={projectIds}
        placeholder={t('Search Feedback')}
        organization={organization}
        onGetTagValues={getTagValues}
        supportedTags={feedbackTags}
        excludedTags={EXCLUDED_TAGS}
        fieldDefinitionGetter={getFeedbackFieldDefinition}
        maxMenuHeight={500}
        defaultQuery=""
        query={decodeScalar(query.query, '')}
        onSearch={onSearch}
      />
    </SearchContainer>
  );
}

const SearchContainer = styled('div')`
  display: grid;
  width: 100%;
`;
