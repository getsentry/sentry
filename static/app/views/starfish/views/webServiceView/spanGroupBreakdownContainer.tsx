import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {getInterval} from 'sentry/components/charts/utils';
import {Panel} from 'sentry/components/panels';
import {space} from 'sentry/styles/space';
import {PageFilters} from 'sentry/types';
import {Series, SeriesDataUnit} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {SpanMetricsFields} from 'sentry/views/starfish/types';
import {useEventsStatsQuery} from 'sentry/views/starfish/utils/useEventsStatsQuery';
import {SpanGroupBreakdown} from 'sentry/views/starfish/views/webServiceView/spanGroupBreakdown';

const {SPAN_SELF_TIME} = SpanMetricsFields;

export const OTHER_SPAN_GROUP_MODULE = 'Other';
export const NULL_SPAN_CATEGORY = '<null>';

type Props = {
  transaction?: string;
  transactionMethod?: string;
};

type Group = {
  'span.category': string;
};

export type Segment = Group & {
  'p95(span.self_time)': number;
  'sum(span.self_time)': number;
};

export type DataRow = {
  cumulativeTime: number;
  group: Group;
};

export function SpanGroupBreakdownContainer({transaction, transactionMethod}: Props) {
  const pageFilter = usePageFilters();
  const organization = useOrganization();
  const location = useLocation();
  const {selection} = pageFilter;
  const theme = useTheme();

  const {data: segments, isLoading: isSegmentsLoading} = useDiscoverQuery({
    eventView: getCumulativeTimeEventView(
      selection,
      `transaction.op:http.server ${transaction ? `transaction:${transaction}` : ''} ${
        transactionMethod ? `http.method:${transactionMethod}` : ''
      }`,
      ['span.category']
    ),
    orgSlug: organization.slug,
    referrer: 'starfish-web-service.span-category-breakdown',
    location,
    limit: 4,
  });

  const {data: cumulativeTime, isLoading: isCumulativeDataLoading} = useDiscoverQuery({
    eventView: getCumulativeTimeEventView(
      selection,
      `transaction.op:http.server ${transaction ? `transaction:${transaction}` : ''} ${
        transactionMethod ? `http.method:${transactionMethod}` : ''
      }`,
      []
    ),
    orgSlug: organization.slug,
    referrer: 'starfish-web-service.total-time',
    location,
  });

  const {
    isLoading: isTopDataLoading,
    data: topData,
    isError,
  } = useEventsStatsQuery({
    eventView: getEventView(
      selection,
      `transaction.op:http.server ${transaction ? `transaction:${transaction}` : ''} ${
        transactionMethod ? `http.method:${transactionMethod}` : ''
      }`,
      ['span.category'],
      true
    ),
    enabled: true,
    referrer: 'starfish-web-service.span-category-breakdown-timeseries',
    initialData: [],
  });

  const totalValues = cumulativeTime?.data[0]?.[`sum(${SPAN_SELF_TIME})`]
    ? parseInt(cumulativeTime?.data[0][`sum(${SPAN_SELF_TIME})`] as string, 10)
    : 0;
  const totalSegments =
    segments?.data.reduce(
      (acc, segment) => acc + parseInt(segment[`sum(${SPAN_SELF_TIME})`] as string, 10),
      0
    ) ?? 0;

  const otherValue = totalValues ? totalValues - totalSegments : 0;

  const transformedData: DataRow[] = [];

  if (defined(segments)) {
    for (let index = 0; index < segments.data.length; index++) {
      const element = segments.data[index];
      const category = element['span.category'] as string;
      transformedData.push({
        cumulativeTime: parseInt(element[`sum(${SPAN_SELF_TIME})`] as string, 10),
        group: {
          'span.category': category === '' ? NULL_SPAN_CATEGORY : category,
        },
      });
    }

    if (otherValue > 0) {
      transformedData.push({
        cumulativeTime: otherValue,
        group: {
          'span.category': OTHER_SPAN_GROUP_MODULE,
        },
      });
    }
  }

  const seriesByDomain: {[category: string]: Series} = {};
  const colorPalette = theme.charts.getColorPalette(transformedData.length - 2);

  if (defined(topData)) {
    if (!isTopDataLoading && transformedData.length > 0) {
      transformedData.forEach((segment, index) => {
        const category = segment.group['span.category'] as string;
        const label = category === '' ? NULL_SPAN_CATEGORY : category;
        seriesByDomain[label] = {
          seriesName: label,
          data: [],
          color: colorPalette[index],
        };
      });

      Object.keys(topData).forEach(key => {
        const seriesData = topData?.[key];
        const label = key === '' ? NULL_SPAN_CATEGORY : key;
        seriesByDomain[label].data =
          seriesData?.data.map(datum => {
            return {name: datum[0] * 1000, value: datum[1][0].count} as SeriesDataUnit;
          }) ?? [];
      });
    }
  }

  const data = Object.values(seriesByDomain);

  const initialShowSeries = transformedData.map(_ => true);

  return (
    <StyledPanel>
      <SpanGroupBreakdown
        tableData={transformedData}
        totalCumulativeTime={totalValues}
        isTableLoading={isSegmentsLoading}
        topSeriesData={data}
        colorPalette={colorPalette}
        initialShowSeries={initialShowSeries}
        isTimeseriesLoading={isTopDataLoading}
        isCumulativeTimeLoading={isCumulativeDataLoading}
        transaction={transaction}
        errored={isError}
      />
    </StyledPanel>
  );
}

const StyledPanel = styled(Panel)`
  padding-top: ${space(2)};
  margin-bottom: 0;
`;

const getEventView = (
  pageFilters: PageFilters,
  query: string,
  groups: string[],
  getTimeseries?: boolean
) => {
  return EventView.fromSavedQuery({
    name: '',
    fields: [`sum(${SPAN_SELF_TIME})`, ...groups],
    yAxis: getTimeseries ? [`sum(${SPAN_SELF_TIME})`] : [],
    query,
    dataset: DiscoverDatasets.SPANS_METRICS,
    start: pageFilters.datetime.start ?? undefined,
    end: pageFilters.datetime.end ?? undefined,
    range: pageFilters.datetime.period ?? undefined,
    orderby: '-sum_span_duration',
    projects: [1],
    version: 2,
    topEvents: groups.length > 0 ? '4' : undefined,
    interval: getTimeseries ? getInterval(pageFilters.datetime, 'low') : undefined,
  });
};

const getCumulativeTimeEventView = (
  pageFilters: PageFilters,
  query: string,
  groups: string[]
) => {
  return EventView.fromSavedQuery({
    name: '',
    fields: [`sum(${SPAN_SELF_TIME})`, ...groups],
    query,
    dataset: DiscoverDatasets.SPANS_METRICS,
    start: pageFilters.datetime.start ?? undefined,
    end: pageFilters.datetime.end ?? undefined,
    range: pageFilters.datetime.period ?? undefined,
    orderby: '-sum_span_duration',
    projects: [1],
    version: 2,
    topEvents: groups.length > 0 ? '4' : undefined,
  });
};
