import type {PageFilters} from 'sentry/types/core';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import useCustomMeasurements from 'sentry/utils/useCustomMeasurements';
import useOrganization from 'sentry/utils/useOrganization';
import type {WidgetBuilderSearchBarProps} from 'sentry/views/dashboards/datasetConfig/base';
import type {WidgetQuery} from 'sentry/views/dashboards/types';
import {eventViewFromWidget, hasDatasetSelector} from 'sentry/views/dashboards/utils';
import ResultsSearchQueryBuilder from 'sentry/views/discover/results/resultsSearchQueryBuilder';

interface Props {
  onClose: WidgetBuilderSearchBarProps['onClose'];
  pageFilters: PageFilters;
  widgetQuery: WidgetQuery;
  dataset?: DiscoverDatasets;
  disabled?: boolean;
  portalTarget?: HTMLElement | null;
}

export function EventsSearchBar({
  pageFilters,
  onClose,
  widgetQuery,
  dataset,
  portalTarget,
  disabled,
}: Props) {
  const organization = useOrganization();
  const {customMeasurements} = useCustomMeasurements();
  const eventView = eventViewFromWidget('', widgetQuery, pageFilters);
  const fields = eventView.hasAggregateField()
    ? eventView.getAggregateFields()
    : eventView.fields;

  return (
    <ResultsSearchQueryBuilder
      projectIds={eventView.project}
      query={widgetQuery.conditions}
      fields={fields}
      onChange={(query, state) => {
        onClose?.(query, {validSearch: state.queryIsValid});
      }}
      disabled={disabled}
      customMeasurements={customMeasurements}
      dataset={dataset}
      includeTransactions={hasDatasetSelector(organization) ? false : true}
      searchSource="widget_builder"
      portalTarget={portalTarget}
    />
  );
}
