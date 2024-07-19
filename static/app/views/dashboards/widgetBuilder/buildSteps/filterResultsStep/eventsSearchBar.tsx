import styled from '@emotion/styled';

import type {SearchBarProps} from 'sentry/components/events/searchBar';
import SearchBar from 'sentry/components/events/searchBar';
import {MAX_QUERY_LENGTH} from 'sentry/constants';
import type {Organization, PageFilters} from 'sentry/types';
import {SavedSearchType} from 'sentry/types';
import {generateAggregateFields} from 'sentry/utils/discover/fields';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import useCustomMeasurements from 'sentry/utils/useCustomMeasurements';
import type {WidgetQuery} from 'sentry/views/dashboards/types';
import {eventViewFromWidget} from 'sentry/views/dashboards/utils';
import {
  MAX_MENU_HEIGHT,
  MAX_SEARCH_ITEMS,
} from 'sentry/views/dashboards/widgetBuilder/utils';

interface Props {
  getFilterWarning: SearchBarProps['getFilterWarning'];
  onClose: SearchBarProps['onClose'];
  organization: Organization;
  pageFilters: PageFilters;
  widgetQuery: WidgetQuery;
  dataset?: DiscoverDatasets;
}

export function EventsSearchBar({
  organization,
  pageFilters,
  getFilterWarning,
  onClose,
  widgetQuery,
  dataset,
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
      getFilterWarning={getFilterWarning}
      useFormWrapper={false}
      maxQueryLength={MAX_QUERY_LENGTH}
      maxSearchItems={MAX_SEARCH_ITEMS}
      maxMenuHeight={MAX_MENU_HEIGHT}
      savedSearchType={SavedSearchType.EVENT}
      customMeasurements={customMeasurements}
      dataset={dataset}
    />
  );
}

const Search = styled(SearchBar)`
  flex-grow: 1;
`;
