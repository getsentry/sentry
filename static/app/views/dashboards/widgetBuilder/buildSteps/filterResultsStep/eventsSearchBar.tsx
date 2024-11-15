import type {SearchBarProps} from 'sentry/components/events/searchBar';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {generateAggregateFields} from 'sentry/utils/discover/fields';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import useCustomMeasurements from 'sentry/utils/useCustomMeasurements';
import type {WidgetQuery} from 'sentry/views/dashboards/types';
import {eventViewFromWidget, hasDatasetSelector} from 'sentry/views/dashboards/utils';
import ResultsSearchQueryBuilder from 'sentry/views/discover/resultsSearchQueryBuilder';

interface Props {
  onClose: SearchBarProps['onClose'];
  organization: Organization;
  pageFilters: PageFilters;
  widgetQuery: WidgetQuery;
  dataset?: DiscoverDatasets;
}

export function EventsSearchBar({
  organization,
  pageFilters,
  onClose,
  widgetQuery,
  dataset,
}: Props) {
  const {customMeasurements} = useCustomMeasurements();
  const eventView = eventViewFromWidget('', widgetQuery, pageFilters);
  const fields = eventView.hasAggregateField()
    ? generateAggregateFields(organization, eventView.fields)
    : eventView.fields;

  return (
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
  );
}
