import styled from '@emotion/styled';

import SearchBar, {SearchBarProps} from 'sentry/components/events/searchBar';
import {MAX_QUERY_LENGTH} from 'sentry/constants';
import {SavedSearchType} from 'sentry/types';
import {ContextualProps} from 'sentry/views/dashboardsV2/datasetConfig/base';
import {WidgetQuery} from 'sentry/views/dashboardsV2/types';
import {
  MAX_MENU_HEIGHT,
  MAX_SEARCH_ITEMS,
} from 'sentry/views/dashboardsV2/widgetBuilder/utils';

interface Props {
  contextualProps: ContextualProps;
  onBlur: SearchBarProps['onBlur'];
  onSearch: SearchBarProps['onSearch'];
  widgetQuery: WidgetQuery;
}

export function EventsSearchBar({contextualProps, onSearch, onBlur, widgetQuery}: Props) {
  const organization = contextualProps.organization;
  const projectIds = contextualProps.pageFilters?.projects;

  return (
    <Search
      searchSource="widget_builder"
      organization={organization!}
      projectIds={projectIds}
      query={widgetQuery.conditions}
      fields={[]}
      onSearch={onSearch}
      onBlur={onBlur}
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
