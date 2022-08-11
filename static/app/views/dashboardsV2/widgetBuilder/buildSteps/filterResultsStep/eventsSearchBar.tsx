import styled from '@emotion/styled';

import SearchBar, {SearchBarProps} from 'sentry/components/events/searchBar';
import {MAX_QUERY_LENGTH} from 'sentry/constants';
import {Organization, PageFilters, SavedSearchType} from 'sentry/types';
import {WidgetQuery} from 'sentry/views/dashboardsV2/types';
import {
  MAX_MENU_HEIGHT,
  MAX_SEARCH_ITEMS,
} from 'sentry/views/dashboardsV2/widgetBuilder/utils';

interface Props {
  organization: Organization;
  pageFilters: PageFilters;
  widgetQuery: WidgetQuery;
  onBlur?: SearchBarProps['onBlur'];
  onClose?: SearchBarProps['onClose'];
}

export function EventsSearchBar({
  organization,
  pageFilters,
  onBlur,
  onClose,
  widgetQuery,
}: Props) {
  const projectIds = pageFilters.projects;

  return (
    <Search
      searchSource="widget_builder"
      organization={organization}
      projectIds={projectIds}
      query={widgetQuery.conditions}
      fields={[]}
      onBlur={onBlur}
      onClose={onClose}
      useFormWrapper={false}
      maxQueryLength={MAX_QUERY_LENGTH}
      maxSearchItems={MAX_SEARCH_ITEMS}
      maxMenuHeight={MAX_MENU_HEIGHT}
      savedSearchType={SavedSearchType.EVENT}
    />
  );
}

const Search = styled(SearchBar)`
  flex-grow: 1;
`;
