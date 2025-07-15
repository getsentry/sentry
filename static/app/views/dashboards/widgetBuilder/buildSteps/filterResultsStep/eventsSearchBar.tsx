import type {SearchBarProps} from 'sentry/components/events/searchBar';
import type {PageFilters} from 'sentry/types/core';
import {generateAggregateFields} from 'sentry/utils/discover/fields';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import useCustomMeasurements from 'sentry/utils/useCustomMeasurements';
import useOrganization from 'sentry/utils/useOrganization';
import type {WidgetQuery} from 'sentry/views/dashboards/types';
import {eventViewFromWidget, hasDatasetSelector} from 'sentry/views/dashboards/utils';
import {useDisableTransactionWidget} from 'sentry/views/dashboards/widgetBuilder/hooks/useDisableTransactionWidget';
import ResultsSearchQueryBuilder from 'sentry/views/discover/results/resultsSearchQueryBuilder';

interface Props {
  onClose: SearchBarProps['onClose'];
  pageFilters: PageFilters;
  widgetQuery: WidgetQuery;
  dataset?: DiscoverDatasets;
  portalTarget?: HTMLElement | null;
}

export function EventsSearchBar({
  pageFilters,
  onClose,
  widgetQuery,
  dataset,
  portalTarget,
}: Props) {
  const organization = useOrganization();
  const {customMeasurements} = useCustomMeasurements();
  const eventView = eventViewFromWidget('', widgetQuery, pageFilters);
  const disableTransactionWidget = useDisableTransactionWidget();
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
      disabled={disableTransactionWidget}
      customMeasurements={customMeasurements}
      dataset={dataset}
      includeTransactions={hasDatasetSelector(organization) ? false : true}
      searchSource="widget_builder"
      portalTarget={portalTarget}
    />
  );
}
