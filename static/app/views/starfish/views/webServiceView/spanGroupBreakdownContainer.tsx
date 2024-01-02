import {useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import {getInterval} from 'sentry/components/charts/utils';
import {SelectOption} from 'sentry/components/compactSelect';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {EventsStats, PageFilters} from 'sentry/types';
import {Series, SeriesDataUnit} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/starfish/utils/constants';
import {useEventsStatsQuery} from 'sentry/views/starfish/utils/useEventsStatsQuery';
import {SpanGroupBreakdown} from 'sentry/views/starfish/views/webServiceView/spanGroupBreakdown';

const {SPAN_SELF_TIME} = SpanMetricsField;

export const NULL_SPAN_CATEGORY = t('custom');

type Props = {
  transaction?: string;
  transactionMethod?: string;
};

type Group = {
  'span.module': string;
};

export type DataRow = {
  cumulativeTime: number;
  group: Group;
};

export enum DataDisplayType {
  DURATION_P95 = 'duration_p95',
  CUMULATIVE_DURATION = 'cumulative_duration',
  PERCENTAGE = 'percentage',
  DURATION_AVG = 'duration_avg',
}

export function SpanGroupBreakdownContainer({transaction, transactionMethod}: Props) {
  const pageFilter = usePageFilters();
  const organization = useOrganization();
  const location = useLocation();
  const {selection} = pageFilter;
  const theme = useTheme();

  const options: SelectOption<DataDisplayType>[] = [
    {label: t('Average Duration'), value: DataDisplayType.DURATION_AVG},
    {label: t('Percentages'), value: DataDisplayType.PERCENTAGE},
    {label: t('Total Duration'), value: DataDisplayType.CUMULATIVE_DURATION},
  ];

  const [dataDisplayType, setDataDisplayType] = useState<DataDisplayType>(
    DataDisplayType.DURATION_AVG
  );

  const {data: segments, isLoading: isSegmentsLoading} = useDiscoverQuery({
    eventView: getCumulativeTimeEventView(
      selection,
      `!span.module:other transaction.op:http.server ${
        transaction ? `transaction:${transaction}` : ''
      } ${transactionMethod ? `http.method:${transactionMethod}` : ''}`,
      ['span.module']
    ),
    orgSlug: organization.slug,
    referrer: 'api.starfish-web-service.span-category-breakdown',
    location: omit(location, 'query.cursor'),
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
    referrer: 'api.starfish-web-service.total-time',
    location: omit(location, 'query.cursor'),
  });

  const {
    isLoading: isTopDataLoading,
    data: topData,
    isError,
  } = useEventsStatsQuery({
    eventView: getEventView(
      selection,
      `!span.module:other transaction.op:http.server ${
        transaction ? `transaction:${transaction}` : ''
      } ${transactionMethod ? `http.method:${transactionMethod}` : ''}`,
      ['span.module'],
      dataDisplayType,
      true
    ),
    enabled: true,
    referrer: 'api.starfish-web-service.span-category-breakdown-timeseries',
    initialData: {},
  });

  const totalValues = cumulativeTime?.data[0]?.[`sum(${SPAN_SELF_TIME})`]
    ? parseInt(cumulativeTime?.data[0][`sum(${SPAN_SELF_TIME})`] as string, 10)
    : 0;

  const transformedData: DataRow[] = [];

  if (defined(segments)) {
    for (let index = 0; index < segments.data.length; index++) {
      const element = segments.data[index];
      const spanModule = element['span.module'] as string;
      transformedData.push({
        cumulativeTime: parseInt(element[`sum(${SPAN_SELF_TIME})`] as string, 10),
        group: {
          'span.module': spanModule === '' ? NULL_SPAN_CATEGORY : spanModule,
        },
      });
    }
  }

  const seriesByDomain: {[spanModule: string]: Series} = {};
  const colorPalette = theme.charts.getColorPalette(transformedData.length - 2);

  if (defined(topData)) {
    if (!isTopDataLoading && transformedData.length > 0) {
      transformedData.forEach((segment, index) => {
        const spanModule = segment.group['span.module'] as string;
        const label = spanModule === '' ? NULL_SPAN_CATEGORY : spanModule;
        seriesByDomain[label] = {
          seriesName: label,
          data: [],
          color: colorPalette[index],
        };
      });

      Object.keys(topData).forEach(key => {
        const seriesData: EventsStats = topData?.[key];
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
        onDisplayTypeChange={setDataDisplayType}
      />
    </StyledPanel>
  );
}

const StyledPanel = styled(Panel)`
  padding-top: ${space(2)};
  margin-bottom: ${space(2)};
`;

const getEventView = (
  pageFilters: PageFilters,
  query: string,
  groups: string[],
  dataDisplayType: DataDisplayType,
  getTimeseries?: boolean
) => {
  const yAxis =
    dataDisplayType === DataDisplayType.DURATION_P95
      ? `p95(${SPAN_SELF_TIME})`
      : dataDisplayType === DataDisplayType.DURATION_AVG
      ? `avg(${SPAN_SELF_TIME})`
      : `sum(${SPAN_SELF_TIME})`;

  return EventView.fromNewQueryWithPageFilters(
    {
      name: '',
      fields: [`sum(${SPAN_SELF_TIME})`, `avg(${SPAN_SELF_TIME})`, ...groups],
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
    pageFilters
  );
};

const getCumulativeTimeEventView = (
  pageFilters: PageFilters,
  query: string,
  groups: string[]
) => {
  return EventView.fromNewQueryWithPageFilters(
    {
      name: '',
      fields: [`sum(${SPAN_SELF_TIME})`, ...groups],
      query,
      dataset: DiscoverDatasets.SPANS_METRICS,
      orderby: '-sum_span_self_time',
      version: 2,
      topEvents: groups.length > 0 ? '4' : undefined,
    },
    pageFilters
  );
};
