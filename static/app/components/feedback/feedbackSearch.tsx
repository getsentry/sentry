import type {CSSProperties} from 'react';
import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {fetchTagValues} from 'sentry/actionCreators/tags';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import type {FilterKeySection} from 'sentry/components/searchQueryBuilder/types';
import SmartSearchBar from 'sentry/components/smartSearchBar';
import {t} from 'sentry/locale';
import type {Organization, Tag, TagCollection, TagValue} from 'sentry/types';
import {browserHistory} from 'sentry/utils/browserHistory';
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
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useTags from 'sentry/utils/useTags';

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
  return {
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
}

/**
 * Returns 2 sections: feedback fields and (filtered, non-field) tags.
 */
function getFilterKeySections(
  supportedTags: TagCollection,
  organization: Organization
): FilterKeySection[] {
  if (!organization.features.includes('search-query-builder-user-feedback')) {
    return [];
  }

  const nonFieldTags: string[] = Object.values(supportedTags)
    .map(tag => tag.key)
    .filter(key => !FEEDBACK_FIELDS.includes(key as FeedbackFieldKey | FieldKey));
  nonFieldTags.sort();

  return [
    {
      value: 'feedback_field',
      label: t('Feedback fields'),
      children: FEEDBACK_FIELDS,
    },
    {
      value: FieldKind.TAG,
      label: t('Tags'),
      children: nonFieldTags,
    },
  ];
}

interface Props {
  className?: string;
  style?: CSSProperties;
}

export default function FeedbackSearch({className, style}: Props) {
  const projectIds = usePageFilters().selection.projects;
  const {pathname, query} = useLocation();
  const organization = useOrganization();
  const organizationTags = useTags();
  const api = useApi();

  const feedbackTags = useMemo(
    () => getFeedbackSearchTags(organizationTags),
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
      }).then(
        tagValues => (tagValues as TagValue[]).map(({value}) => value),
        () => {
          throw new Error('Unable to fetch event field values');
        }
      );
    },
    [api, organization.slug, projectIds]
  );

  if (organization.features.includes('search-query-builder-user-feedback')) {
    return (
      <SearchQueryBuilder
        initialQuery={decodeScalar(query.query, '')}
        filterKeys={feedbackTags}
        filterKeySections={filterKeySections}
        getTagValues={getTagValues}
        onSearch={searchQuery => {
          browserHistory.push({
            pathname,
            query: {
              ...query,
              cursor: undefined,
              query: searchQuery.trim(),
            },
          });
        }}
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
        onSearch={searchQuery => {
          browserHistory.push({
            pathname,
            query: {
              ...query,
              cursor: undefined,
              query: searchQuery.trim(),
            },
          });
        }}
      />
    </SearchContainer>
  );
}

const SearchContainer = styled('div')`
  display: grid;
  width: 100%;
`;
