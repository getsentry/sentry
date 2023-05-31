import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';
import memoize from 'lodash/memoize';

import {fetchTagValues} from 'sentry/actionCreators/tags';
import {SearchBarProps} from 'sentry/components/events/searchBar';
import {InvalidReason} from 'sentry/components/searchSyntax/parser';
import SmartSearchBar from 'sentry/components/smartSearchBar';
import {MAX_QUERY_LENGTH, NEGATION_OPERATOR, SEARCH_WILDCARD} from 'sentry/constants';
import {t} from 'sentry/locale';
import {Organization, PageFilters, SavedSearchType, Tag, TagValue} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import {WidgetQuery} from 'sentry/views/dashboards/types';
import {
  MAX_MENU_HEIGHT,
  MAX_SEARCH_ITEMS,
} from 'sentry/views/dashboards/widgetBuilder/utils';

import {SESSION_STATUSES, SESSIONS_FILTER_TAGS} from '../../releaseWidget/fields';

const SEARCH_SPECIAL_CHARS_REGEXP = new RegExp(
  `^${NEGATION_OPERATOR}|\\${SEARCH_WILDCARD}`,
  'g'
);
interface Props {
  onClose: SearchBarProps['onClose'];
  organization: Organization;
  pageFilters: PageFilters;
  widgetQuery: WidgetQuery;
}

export function ReleaseSearchBar({
  organization,
  pageFilters,
  widgetQuery,
  onClose,
}: Props) {
  const orgSlug = organization.slug;
  const projectIds = pageFilters.projects;

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
    return fetchTagValues({
      api,
      orgSlug,
      tagKey: tag.key,
      search: searchQuery,
      projectIds: projectIdStrings,
      includeTransactions: true,
    }).then(
      tagValues => (tagValues as TagValue[]).map(({value}) => value),
      () => {
        throw new Error('Unable to fetch tag values');
      }
    );
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
          placeholder={t('Search for release version, session status, and more')}
          prepareQuery={prepareQuery}
          dropdownClassName={css`
            max-height: ${MAX_MENU_HEIGHT ?? 300}px;
            overflow-y: auto;
          `}
          onClose={onClose}
          maxQueryLength={MAX_QUERY_LENGTH}
          maxSearchItems={MAX_SEARCH_ITEMS}
          searchSource="widget_builder"
          query={widgetQuery.conditions}
          savedSearchType={SavedSearchType.SESSION}
          invalidMessages={{
            [InvalidReason.WILDCARD_NOT_ALLOWED]: t(
              "Release queries don't support wildcards."
            ),
          }}
          hasRecentSearches
          highlightUnsupportedTags
          disallowWildcard
        />
      )}
    </ClassNames>
  );
}

const SearchBar = styled(SmartSearchBar)`
  flex-grow: 1;
`;
