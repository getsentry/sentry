import {useCallback, useEffect} from 'react';

import {fetchTagValues, loadOrganizationTags} from 'sentry/actionCreators/tags';
import SmartSearchBar from 'sentry/components/smartSearchBar';
import {MAX_QUERY_LENGTH, NEGATION_OPERATOR, SEARCH_WILDCARD} from 'sentry/constants';
import {t} from 'sentry/locale';
import {
  Organization,
  PageFilters,
  SavedSearchType,
  Tag,
  TagCollection,
  TagValue,
} from 'sentry/types';
import {isAggregateField} from 'sentry/utils/discover/fields';
import {FieldKind, getFieldDefinition, REPLAY_FIELDS} from 'sentry/utils/fields';
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
        kind: getReplayFieldDefinition(key)?.kind,
      },
    ])
  );
}

const REPLAY_FIELDS_AS_TAGS = fieldDefinitionsToTagCollection(REPLAY_FIELDS);

function getSupportedTags(supportedTags: TagCollection) {
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
    ...REPLAY_FIELDS_AS_TAGS,
  };
}

type Props = React.ComponentProps<typeof SmartSearchBar> & {
  organization: Organization;
  pageFilters: PageFilters;
};

function ReplaySearchBar(props: Props) {
  const {organization, pageFilters} = props;
  const api = useApi();
  const projectIdStrings = pageFilters.projects?.map(String);
  const tags = useTags();
  useEffect(() => {
    loadOrganizationTags(api, organization.slug, pageFilters);
  }, [api, organization.slug, pageFilters]);

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
        includeReplays: true,
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
    <SmartSearchBar
      {...props}
      onGetTagValues={getTagValues}
      supportedTags={getSupportedTags(tags)}
      placeholder={t('Search for users, duration, count_errors, and more')}
      prepareQuery={prepareQuery}
      maxQueryLength={MAX_QUERY_LENGTH}
      searchSource="replay_index"
      savedSearchType={SavedSearchType.REPLAY}
      maxMenuHeight={500}
      hasRecentSearches
      fieldDefinitionGetter={getReplayFieldDefinition}
    />
  );
}

export default ReplaySearchBar;
