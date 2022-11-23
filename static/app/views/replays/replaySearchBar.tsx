import SmartSearchBar from 'sentry/components/smartSearchBar';
import {MAX_QUERY_LENGTH, NEGATION_OPERATOR, SEARCH_WILDCARD} from 'sentry/constants';
import {t} from 'sentry/locale';
import {Organization, PageFilters, SavedSearchType, TagCollection} from 'sentry/types';
import {getFieldDefinition, REPLAY_FIELDS} from 'sentry/utils/fields';

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

const REPLAY_TAGS = fieldDefinitionsToTagCollection(REPLAY_FIELDS);

type Props = React.ComponentProps<typeof SmartSearchBar> & {
  organization: Organization;
  pageFilters: PageFilters;
};

function SearchBar(props: Props) {
  return (
    <SmartSearchBar
      {...props}
      onGetTagValues={undefined}
      supportedTags={REPLAY_TAGS}
      placeholder={t('Search for users, duration, countErrors, and more')}
      prepareQuery={prepareQuery}
      maxQueryLength={MAX_QUERY_LENGTH}
      searchSource="replay_index"
      savedSearchType={SavedSearchType.REPLAY}
      maxMenuHeight={500}
      hasRecentSearches
      highlightUnsupportedTags
      fieldDefinitionGetter={getReplayFieldDefinition}
    />
  );
}

export default SearchBar;
