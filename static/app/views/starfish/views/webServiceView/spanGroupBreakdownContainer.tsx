import {useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {getInterval} from 'sentry/components/charts/utils';
import {SelectOption} from 'sentry/components/compactSelect';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
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
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/starfish/utils/constants';
import {useEventsStatsQuery} from 'sentry/views/starfish/utils/useEventsStatsQuery';
import {SpanGroupBreakdown} from 'sentry/views/starfish/views/webServiceView/spanGroupBreakdown';

const {SPAN_SELF_TIME} = SpanMetricsFields;

const OTHER_SPAN_GROUP_MODULE = 'Other';
export const NULL_SPAN_CATEGORY = t('custom');

type Props = {
  transaction?: string;
  transactionMethod?: string;
};

type Group = {
  'span.category': string;
};

export type DataRow = {
  cumulativeTime: number;
  group: Group;
};

export enum DataDisplayType {
  DURATION_P95 = 'duration_p95',
  CUMULATIVE_DURATION = 'cumulative_duration',
  PERCENTAGE = 'percentage',
}

export function SpanGroupBreakdownContainer({transaction, transactionMethod}: Props) {
  const pageFilter = usePageFilters();
  const organization = useOrganization();
  const location = useLocation();
  const {selection} = pageFilter;
  const theme = useTheme();

  const options: SelectOption<DataDisplayType>[] = [
    {label: 'Percentages', value: DataDisplayType.PERCENTAGE},
    {label: 'Duration (p95)', value: DataDisplayType.DURATION_P95},
    {label: 'Total Duration', value: DataDisplayType.CUMULATIVE_DURATION},
  ];

  const [dataDisplayType, setDataDisplayType] = useState<DataDisplayType>(
    DataDisplayType.PERCENTAGE
  );

  const {data: segments, isLoading: isSegmentsLoading} = useDiscoverQuery({
    eventView: getCumulativeTimeEventView(
      location,
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
      location,
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
      location,
      selection,
      `transaction.op:http.server ${transaction ? `transaction:${transaction}` : ''} ${
        transactionMethod ? `http.method:${transactionMethod}` : ''
      }`,
      ['span.category'],
      dataDisplayType,
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

    if (otherValue > 0 && OTHER_SPAN_GROUP_MODULE in topData) {
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

  return (
    <StyledPanel>
      <SpanGroupBreakdown
        tableData={transformedData}
        totalCumulativeTime={totalValues}
        isTableLoading={isSegmentsLoading}
        topSeriesData={data}
        colorPalette={colorPalette}
        isTimeseriesLoading={isTopDataLoading}
        isCumulativeTimeLoading={isCumulativeDataLoading}
        transaction={transaction}
        errored={isError}
        options={options}
        dataDisplayType={dataDisplayType}
        setDataDisplayType={setDataDisplayType}
      />
    </StyledPanel>
  );
}

const StyledPanel = styled(Panel)`
  padding-top: ${space(2)};
  margin-bottom: 0;
`;

const getEventView = (
  location: Location,
  pageFilters: PageFilters,
  query: string,
  groups: string[],
  dataDisplayType: DataDisplayType,
  getTimeseries?: boolean
) => {
  const yAxis =
    dataDisplayType === DataDisplayType.DURATION_P95
      ? `p95(${SPAN_SELF_TIME})`
      : `sum(${SPAN_SELF_TIME})`;

  return EventView.fromNewQueryWithLocation(
    {
      name: '',
      fields: [`sum(${SPAN_SELF_TIME})`, `p95(${SPAN_SELF_TIME})`, ...groups],
      yAxis: getTimeseries ? [yAxis] : [],
      query,
      dataset: DiscoverDatasets.SPANS_METRICS,
      orderby: '-sum_span_self_time',
      version: 2,
      topEvents: groups.length > 0 ? '4' : undefined,
      interval: getTimeseries
        ? getInterval(pageFilters.datetime, STARFISH_CHART_INTERVAL_FIDELITY)
        : undefined,
    },
    location
  );
};

const getCumulativeTimeEventView = (
  location: Location,
  query: string,
  groups: string[]
) => {
  return EventView.fromNewQueryWithLocation(
    {
      name: '',
      fields: [`sum(${SPAN_SELF_TIME})`, ...groups],
      query,
      dataset: DiscoverDatasets.SPANS_METRICS,
      orderby: '-sum_span_self_time',
      version: 2,
      topEvents: groups.length > 0 ? '4' : undefined,
    },
    location
  );
};
