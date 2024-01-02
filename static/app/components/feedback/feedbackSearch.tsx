import {CSSProperties, useCallback} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import {fetchTagValues} from 'sentry/actionCreators/tags';
import SmartSearchBar from 'sentry/components/smartSearchBar';
import {t} from 'sentry/locale';
import {Tag, TagCollection, TagValue} from 'sentry/types';
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
  FeedbackFieldKey.MESSAGE,
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

function getSupportedTags(supportedTags: TagCollection) {
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

interface Props {
  className?: string;
  style?: CSSProperties;
}

export default function FeedbackSearch({className, style}: Props) {
  const projectIdStrings = usePageFilters().selection.projects?.map(String);
  const {pathname, query} = useLocation();
  const organization = useOrganization();
  const tags = useTags();
  const api = useApi();

  const getTagValues = useCallback(
    (tag: Tag, searchQuery: string, _params: object): Promise<string[]> => {
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
        projectIds: projectIdStrings,
      }).then(
        tagValues => (tagValues as TagValue[]).map(({value}) => value),
        () => {
          throw new Error('Unable to fetch event field values');
        }
      );
    },
    [api, organization.slug, projectIdStrings]
  );

  return (
    <SearchContainer className={className} style={style}>
      <SmartSearchBar
        hasRecentSearches
        placeholder={t('Search Feedback')}
        organization={organization}
        onGetTagValues={getTagValues}
        supportedTags={getSupportedTags(tags)}
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
