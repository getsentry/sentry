import styled from '@emotion/styled';

import type {SearchBarProps} from 'sentry/components/events/searchBar';
import SearchBar from 'sentry/components/events/searchBar';
import {MAX_QUERY_LENGTH} from 'sentry/constants';
import type {PageFilters} from 'sentry/types/core';
import {SavedSearchType} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {generateAggregateFields} from 'sentry/utils/discover/fields';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import useCustomMeasurements from 'sentry/utils/useCustomMeasurements';
import type {WidgetQuery} from 'sentry/views/dashboards/types';
import {eventViewFromWidget, hasDatasetSelector} from 'sentry/views/dashboards/utils';
import {
  MAX_MENU_HEIGHT,
  MAX_SEARCH_ITEMS,
} from 'sentry/views/dashboards/widgetBuilder/utils';
import ResultsSearchQueryBuilder from 'sentry/views/discover/resultsSearchQueryBuilder';

interface Props {
  getFilterWarning: SearchBarProps['getFilterWarning'];
  onClose: SearchBarProps['onClose'];
  organization: Organization;
  pageFilters: PageFilters;
  widgetQuery: WidgetQuery;
  dataset?: DiscoverDatasets;
  savedSearchType?: SavedSearchType;
}

export function EventsSearchBar({
  organization,
  pageFilters,
  getFilterWarning,
  onClose,
  widgetQuery,
  dataset,
  savedSearchType = SavedSearchType.EVENT,
}: Props) {
  const {customMeasurements} = useCustomMeasurements();
  const projectIds = pageFilters.projects;
  const eventView = eventViewFromWidget('', widgetQuery, pageFilters);
  const fields = eventView.hasAggregateField()
    ? generateAggregateFields(organization, eventView.fields)
    : eventView.fields;

  return organization.features.includes('search-query-builder-discover') ? (
    <ResultsSearchQueryBuilder
      projectIds={eventView.project}
      query={widgetQuery.conditions}
      fields={fields}
      onChange={(query, state) => {
        onClose?.(query, {validSearch: state.queryIsValid});
      }}
      customMeasurements={customMeasurements}
      dataset={dataset}
      includeTransactions={hasDatasetSelector(organization) ? false : true}
      searchSource="widget_builder"
    />
  ) : (
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
      savedSearchType={savedSearchType}
      customMeasurements={customMeasurements}
      dataset={dataset}
      includeTransactions={hasDatasetSelector(organization) ? false : true}
    />
  );
}

const Search = styled(SearchBar)`
  flex-grow: 1;
`;
