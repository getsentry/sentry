import type {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {type DatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {transformEventsResponseToTable} from 'sentry/views/dashboards/datasetConfig/events';
import {transformTimeSeriesResponse} from 'sentry/views/dashboards/utils/transformTimeSeriesResponse';
import {isPerformanceScoreBreakdownChart} from 'sentry/views/dashboards/widgetBuilder/utils/isPerformanceScoreBreakdownChart';
import {transformPerformanceScoreBreakdownTimeSeries} from 'sentry/views/dashboards/widgetBuilder/utils/transformPerformanceScoreBreakdownSeries';

export const spansResponseTransforms: Pick<
  DatasetConfig<EventsTimeSeriesResponse, TableData | EventsTableData>,
  'transformTable' | 'transformTimeSeries'
> = {
  transformTable: transformEventsResponseToTable,
  transformTimeSeries: (data, widget, queryIndex) =>
    transformTimeSeriesResponse(
      isPerformanceScoreBreakdownChart(widget.queries[queryIndex]!)
        ? transformPerformanceScoreBreakdownTimeSeries(data)
        : data,
      widget,
      queryIndex
    ),
};
