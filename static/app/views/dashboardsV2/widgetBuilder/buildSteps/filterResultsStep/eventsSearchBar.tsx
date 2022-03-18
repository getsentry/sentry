import styled from '@emotion/styled';

import SearchBar, {SearchBarProps} from 'sentry/components/events/searchBar';
import {MAX_QUERY_LENGTH} from 'sentry/constants';
import {Organization} from 'sentry/types';
import {WidgetQuery} from 'sentry/views/dashboardsV2/types';

interface Props {
  onBlur: SearchBarProps['onBlur'];
  onSearch: SearchBarProps['onSearch'];
  organization: Organization;
  projectIds: SearchBarProps['projectIds'];
  query: WidgetQuery;
}

export function EventsSearchBar({
  projectIds,
  onSearch,
  onBlur,
  organization,
  query,
}: Props) {
  return (
    <Search
      searchSource="widget_builder"
      organization={organization}
      projectIds={projectIds}
      query={query.conditions}
      fields={[]}
      onSearch={onSearch}
      onBlur={onBlur}
      useFormWrapper={false}
      maxQueryLength={MAX_QUERY_LENGTH}
    />
  );
}

const Search = styled(SearchBar)`
  flex-grow: 1;
`;
