import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';
import memoize from 'lodash/memoize';

import {fetchTagValues} from 'sentry/actionCreators/tags';
import {SearchBarProps} from 'sentry/components/events/searchBar';
import SmartSearchBar from 'sentry/components/smartSearchBar';
import {MAX_QUERY_LENGTH, NEGATION_OPERATOR, SEARCH_WILDCARD} from 'sentry/constants';
import {t} from 'sentry/locale';
import {Organization, PageFilters, SavedSearchType, Tag, TagValue} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import {
  MAX_MENU_HEIGHT,
  MAX_SEARCH_ITEMS,
} from 'sentry/views/dashboardsV2/widgetBuilder/utils';

const SESSIONS_FILTER_TAGS = ['os.name', 'os', 'device.manufacturer', 'device.family'];

const SEARCH_SPECIAL_CHARS_REGEXP = new RegExp(
  `^${NEGATION_OPERATOR}|\\${SEARCH_WILDCARD}`,
  'g'
);
interface Props {
  conditions: string;
  onClose: SearchBarProps['onClose'];
  organization: Organization;
  pageFilters: PageFilters;
}

export function ReleaseSearchBar({conditions, onClose}: Props) {
  /**
   * Prepare query string (e.g. strip special characters like negation operator)
   */
  function prepareQuery(searchQuery: string) {
    return searchQuery.replace(SEARCH_SPECIAL_CHARS_REGEXP, '');
  }

  function getTagValues(tag: Tag, _searchQuery: string): Promise<string[]> {
    if (tag.name === 'os') {
      return Promise.resolve(['Android 11', 'iOS 10']);
    }
    if (tag.name === 'os.name') {
      return Promise.resolve(['Android', 'iOS']);
    }
    if (tag.name === 'device.family') {
      return Promise.resolve(['iPhone', 'Nexus']);
    }
    return Promise.resolve(['Apple', 'Google']);
  }

  const supportedTags = Object.values(SESSIONS_FILTER_TAGS).reduce((acc, key) => {
    acc[key] = {key, name: key};
    return acc;
  }, {});

  return (
    <ClassNames>
      {({css}) => (
        <SearchBar
          onGetTagValues={memoize(
            getTagValues,
            ({key}, searchQuery) => `${key}-${searchQuery}`
          )}
          supportedTags={supportedTags}
          placeholder={t('Search for OS and device properties')}
          prepareQuery={prepareQuery}
          dropdownClassName={css`
            max-height: ${MAX_MENU_HEIGHT ?? 300}px;
            overflow-y: auto;
          `}
          onClose={onClose}
          maxQueryLength={MAX_QUERY_LENGTH}
          maxSearchItems={MAX_SEARCH_ITEMS}
          searchSource="release_detail"
          query={conditions}
          savedSearchType={SavedSearchType.SESSION}
          hasRecentSearches
        />
      )}
    </ClassNames>
  );
}

const SearchBar = styled(SmartSearchBar)`
  flex-grow: 1;
`;
