import {useState} from 'react';

import type {Client} from 'sentry/api';
import {isMultiSeriesStats} from 'sentry/components/charts/utils';
import type {PageFilters} from 'sentry/types/core';
import type {
  Confidence,
  EventsStats,
  MultiSeriesEventsStats,
  Organization,
} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {dedupeArray} from 'sentry/utils/dedupeArray';
import type {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';
import getDynamicText from 'sentry/utils/getDynamicText';
import {determineSeriesConfidence} from 'sentry/views/alerts/rules/metric/utils/determineSeriesConfidence';
import {SpansConfig} from 'sentry/views/dashboards/datasetConfig/spans';
import {combineConfidenceForSeries} from 'sentry/views/explore/utils';
import {transformToSeriesMap} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

import type {DashboardFilters, Widget} from '../types';

import type {
  GenericWidgetQueriesChildrenProps,
  OnDataFetchedProps,
} from './genericWidgetQueries';
import GenericWidgetQueries from './genericWidgetQueries';

type SeriesResult = EventsStats | MultiSeriesEventsStats;
type TableResult = TableData | EventsTableData;

type Props = {
  api: Client;
  children: (props: GenericWidgetQueriesChildrenProps) => JSX.Element;
  organization: Organization;
  selection: PageFilters;
  widget: Widget;
  cursor?: string;
  dashboardFilters?: DashboardFilters;
  limit?: number;
  onDataFetched?: (results: OnDataFetchedProps) => void;
};

function SpansWidgetQueries({
  children,
  api,
  organization,
  selection,
  widget,
  cursor,
  limit,
  dashboardFilters,
  onDataFetched,
}: Props) {
  const config = SpansConfig;

  const [confidence, setConfidence] = useState<Confidence | null>(null);

  const afterFetchSeriesData = (result: SeriesResult) => {
    if (isMultiSeriesStats(result)) {
      const dedupedYAxes = dedupeArray(widget.queries[0]?.aggregates ?? []);
      const seriesMap = transformToSeriesMap(result, dedupedYAxes);
      const series = dedupedYAxes.flatMap(yAxis => seriesMap[yAxis]).filter(defined);
      const seriesConfidence = combineConfidenceForSeries(series);
      setConfidence(seriesConfidence);
    } else {
      const seriesConfidence = determineSeriesConfidence(result);
      setConfidence(seriesConfidence);
    }
  };

  return getDynamicText({
    value: (
      <GenericWidgetQueries<SeriesResult, TableResult>
        config={config}
        api={api}
        organization={organization}
        selection={selection}
        widget={widget}
        cursor={cursor}
        limit={limit}
        dashboardFilters={dashboardFilters}
        onDataFetched={onDataFetched}
        afterFetchSeriesData={afterFetchSeriesData}
      >
        {props =>
          children({
            ...props,
            confidence,
          })
        }
      </GenericWidgetQueries>
    ),
    fixed: <div />,
  });
}

export default SpansWidgetQueries;
