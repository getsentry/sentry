import styled from '@emotion/styled';

import SearchBar, {SearchBarProps} from 'sentry/components/events/searchBar';
import {MAX_QUERY_LENGTH} from 'sentry/constants';
import type {Organization, PageFilters} from 'sentry/types';
import {SavedSearchType} from 'sentry/types/group';
import {generateAggregateFields} from 'sentry/utils/discover/fields';
import useCustomMeasurements from 'sentry/utils/useCustomMeasurements';
import {WidgetQuery} from 'sentry/views/dashboardsV2/types';
import {eventViewFromWidget} from 'sentry/views/dashboardsV2/utils';
import {
  MAX_MENU_HEIGHT,
  MAX_SEARCH_ITEMS,
} from 'sentry/views/dashboardsV2/widgetBuilder/utils';

interface Props {
  onClose: SearchBarProps['onClose'];
  organization: Organization;
  pageFilters: PageFilters;
  widgetQuery: WidgetQuery;
}

export function EventsSearchBar({
  organization,
  pageFilters,
  onClose,
  widgetQuery,
}: Props) {
  const {customMeasurements} = useCustomMeasurements();
  const projectIds = pageFilters.projects;
  const eventView = eventViewFromWidget('', widgetQuery, pageFilters);
  const fields = eventView.hasAggregateField()
    ? generateAggregateFields(organization, eventView.fields)
    : eventView.fields;

  return (
    <Search
      searchSource="widget_builder"
      organization={organization}
      projectIds={projectIds}
      query={widgetQuery.conditions}
      fields={fields}
      onClose={onClose}
      useFormWrapper={false}
      maxQueryLength={MAX_QUERY_LENGTH}
      maxSearchItems={MAX_SEARCH_ITEMS}
      maxMenuHeight={MAX_MENU_HEIGHT}
      savedSearchType={SavedSearchType.EVENT}
      customMeasurements={customMeasurements}
    />
  );
}

const Search = styled(SearchBar)`
  flex-grow: 1;
`;
