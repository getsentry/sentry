import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';
import memoize from 'lodash/memoize';

import {fetchTagValues} from 'sentry/actionCreators/tags';
import {SearchBarProps} from 'sentry/components/events/searchBar';
import SmartSearchBar from 'sentry/components/smartSearchBar';
import {MAX_QUERY_LENGTH, NEGATION_OPERATOR, SEARCH_WILDCARD} from 'sentry/constants';
import {Organization, Tag, TagValue} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import {WidgetQuery} from 'sentry/views/dashboardsV2/types';
import {
  MAX_MENU_HEIGHT,
  MAX_SEARCH_ITEMS,
} from 'sentry/views/dashboardsV2/widgetBuilder/utils';

import {SESSION_STATUSES, SESSIONS_TAGS} from '../../releaseWidget/fields';

const SEARCH_SPECIAL_CHARS_REGEXP = new RegExp(
  `^${NEGATION_OPERATOR}|\\${SEARCH_WILDCARD}`,
  'g'
);
interface Props {
  onSearch: SearchBarProps['onSearch'];
  orgSlug: Organization['slug'];
  projectIds: SearchBarProps['projectIds'];
  query: WidgetQuery;
  onBlur?: SearchBarProps['onBlur'];
}

export function ReleaseSearchBar({orgSlug, query, projectIds, onSearch, onBlur}: Props) {
  const api = useApi();

  /**
   * Prepare query string (e.g. strip special characters like negation operator)
   */
  function prepareQuery(searchQuery: string) {
    return searchQuery.replace(SEARCH_SPECIAL_CHARS_REGEXP, '');
  }

  function getTagValues(tag: Tag, searchQuery: string): Promise<string[]> {
    if (tag.name === 'session.status') {
      return Promise.resolve(SESSION_STATUSES);
    }
    const projectIdStrings = projectIds?.map(String);
    return fetchTagValues(api, orgSlug, tag.key, searchQuery, projectIdStrings).then(
      tagValues => (tagValues as TagValue[]).map(({value}) => value),
      () => {
        throw new Error('Unable to fetch tag values');
      }
    );
  }

  const supportedTags = Object.values(SESSIONS_TAGS).reduce((acc, key) => {
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
          prepareQuery={prepareQuery}
          excludeEnvironment
          dropdownClassName={css`
            max-height: ${MAX_MENU_HEIGHT ?? 300}px;
            overflow-y: auto;
          `}
          onSearch={onSearch}
          onBlur={onBlur}
          maxQueryLength={MAX_QUERY_LENGTH}
          maxSearchItems={MAX_SEARCH_ITEMS}
          searchSource="widget_builder"
          query={query.conditions}
          hasRecentSearches
        />
      )}
    </ClassNames>
  );
}

const SearchBar = styled(SmartSearchBar)`
  flex-grow: 1;
`;
