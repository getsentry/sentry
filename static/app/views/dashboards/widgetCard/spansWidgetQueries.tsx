import {useState} from 'react';

import type {Client} from 'sentry/api';
import type {PageFilters} from 'sentry/types/core';
import type {
  Confidence,
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
  Organization,
} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {dedupeArray} from 'sentry/utils/dedupeArray';
import type {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';
import getDynamicText from 'sentry/utils/getDynamicText';
import {determineSeriesConfidence} from 'sentry/views/alerts/rules/metric/utils/determineSeriesConfidence';
import {determineSeriesSampleCountAndIsSampled} from 'sentry/views/alerts/rules/metric/utils/determineSeriesSampleCount';
import {SpansConfig} from 'sentry/views/dashboards/datasetConfig/spans';
import {combineConfidenceForSeries} from 'sentry/views/explore/utils';
import {
  convertEventsStatsToTimeSeriesData,
  transformToSeriesMap,
} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

import type {DashboardFilters, Widget} from '../types';
import {isEventsStats} from '../utils/isEventsStats';

import type {
  GenericWidgetQueriesChildrenProps,
  OnDataFetchedProps,
} from './genericWidgetQueries';
import GenericWidgetQueries from './genericWidgetQueries';

type SeriesResult = EventsStats | MultiSeriesEventsStats | GroupedMultiSeriesEventsStats;
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
  const [sampleCount, setSampleCount] = useState<number | undefined>(undefined);
  const [isSampled, setIsSampled] = useState<boolean | null>(null);

  const afterFetchSeriesData = (result: SeriesResult) => {
    let seriesConfidence;
    let seriesSampleCount;
    let seriesIsSampled;

    if (isEventsStats(result)) {
      seriesConfidence = determineSeriesConfidence(result);
      const {sampleCount: calculatedSampleCount, isSampled: calculatedIsSampled} =
        determineSeriesSampleCountAndIsSampled(
          [
            convertEventsStatsToTimeSeriesData(
              widget.queries[0]?.aggregates[0] ?? '',
              result
            )[1],
          ],
          false
        );
      seriesSampleCount = calculatedSampleCount;
      seriesIsSampled = calculatedIsSampled;
    } else {
      const dedupedYAxes = dedupeArray(widget.queries[0]?.aggregates ?? []);
      const seriesMap = transformToSeriesMap(result, dedupedYAxes);
      const series = dedupedYAxes.flatMap(yAxis => seriesMap[yAxis]).filter(defined);
      const {sampleCount: calculatedSampleCount, isSampled: calculatedIsSampled} =
        determineSeriesSampleCountAndIsSampled(
          series,
          Object.keys(result).filter(seriesName => seriesName.toLowerCase() !== 'other')
            .length > 0
        );
      seriesSampleCount = calculatedSampleCount;
      seriesConfidence = combineConfidenceForSeries(series);
      seriesIsSampled = calculatedIsSampled;
    }

    setConfidence(seriesConfidence);
    setSampleCount(seriesSampleCount);
    setIsSampled(seriesIsSampled);
    onDataFetched?.({
      confidence: seriesConfidence,
      sampleCount: seriesSampleCount,
      isSampled: seriesIsSampled,
    });
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
            sampleCount,
            isSampled,
          })
        }
      </GenericWidgetQueries>
    ),
    fixed: <div />,
  });
}

export default SpansWidgetQueries;
