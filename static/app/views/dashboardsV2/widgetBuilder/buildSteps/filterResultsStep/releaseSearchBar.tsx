import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';
import memoize from 'lodash/memoize';

import {SearchBarProps} from 'sentry/components/events/searchBar';
import SmartSearchBar from 'sentry/components/smartSearchBar';
import {MAX_QUERY_LENGTH, NEGATION_OPERATOR, SEARCH_WILDCARD} from 'sentry/constants';
import {MetricsTagValue, Organization, Tag} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import {useMetricsContext} from 'sentry/utils/useMetricsContext';
import {WidgetQuery} from 'sentry/views/dashboardsV2/types';
import {
  MAX_MENU_HEIGHT,
  MAX_SEARCH_ITEMS,
} from 'sentry/views/dashboardsV2/widgetBuilder/utils';

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
  const {tags} = useMetricsContext();

  /**
   * Prepare query string (e.g. strip special characters like negation operator)
   */
  function prepareQuery(searchQuery: string) {
    return searchQuery.replace(SEARCH_SPECIAL_CHARS_REGEXP, '');
  }

  function fetchTagValues(tagKey: string) {
    return api.requestPromise(`/organizations/${orgSlug}/metrics/tags/${tagKey}/`, {
      query: {project: projectIds},
    });
  }

  function getTagValues(tag: Tag, _query: string): Promise<string[]> {
    return fetchTagValues(tag.key).then(
      tagValues => (tagValues as MetricsTagValue[]).map(({value}) => value),
      () => {
        throw new Error('Unable to fetch tag values');
      }
    );
  }

  const supportedTags = Object.values(tags).reduce((acc, {key}) => {
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
