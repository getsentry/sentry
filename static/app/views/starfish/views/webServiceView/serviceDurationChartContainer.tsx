import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {getInterval} from 'sentry/components/charts/utils';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Series, SeriesDataUnit} from 'sentry/types/echarts';
import {tooltipFormatterUsingAggregateOutputType} from 'sentry/utils/discover/charts';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import usePageFilters from 'sentry/utils/usePageFilters';
import {P95_COLOR} from 'sentry/views/starfish/colours';
import Chart, {useSynchronizeCharts} from 'sentry/views/starfish/components/chart';
import MiniChartPanel from 'sentry/views/starfish/components/miniChartPanel';
import {SpanMetricsFields} from 'sentry/views/starfish/types';
import {useEventsStatsQuery} from 'sentry/views/starfish/utils/useEventsStatsQuery';
import {NULL_SPAN_CATEGORY} from 'sentry/views/starfish/views/webServiceView/spanGroupBreakdownContainer';

const {SPAN_SELF_TIME} = SpanMetricsFields;

type Props = {
  transaction?: string;
  transactionMethod?: string;
};

export function ServiceDurationChartContainer({transaction, transactionMethod}: Props) {
  const pageFilters = usePageFilters();
  const {selection} = pageFilters;

  const [selectedSeries, setSelectedSeries] = useState('Overall');

  const serviceEventView = EventView.fromNewQueryWithPageFilters(
    {
      name: '',
      fields: [`p95(transaction.duration)`],
      yAxis: [`p95(transaction.duration)`],
      query: `transaction.op:http.server ${
        transaction ? `transaction:${transaction}` : ''
      } ${transactionMethod ? `http.method:${transactionMethod}` : ''}`,
      dataset: DiscoverDatasets.METRICS,
      version: 2,
      interval: getInterval(selection.datetime, 'low'),
    },
    selection
  );

  const {
    isLoading: isServiceDurationLoading,
    data: serviceDuration,
    isError,
  } = useEventsStatsQuery({
    eventView: serviceEventView,
    enabled: true,
    referrer: 'starfish-web-service.p95-duration-timeseries',
    initialData: {},
  });

  const durationSeries: {[category: string]: Series} = {};

  durationSeries.Overall = {
    seriesName: 'Overall',
    data:
      serviceDuration?.data?.map(datum => {
        return {name: datum[0] * 1000, value: datum[1][0].count} as SeriesDataUnit;
      }) ?? [],
  };

  const categoryEventView = EventView.fromNewQueryWithPageFilters(
    {
      name: '',
      fields: [`p95(${SPAN_SELF_TIME})`, `sum(${SPAN_SELF_TIME})`, 'span.category'],
      yAxis: [`p95(${SPAN_SELF_TIME})`],
      query: `transaction.op:http.server ${
        transaction ? `transaction:${transaction}` : ''
      } ${transactionMethod ? `transaction.method:${transactionMethod}` : ''}`,
      dataset: DiscoverDatasets.SPANS_METRICS,
      orderby: '-sum_span_self_time',
      version: 2,
      topEvents: '4',
      interval: getInterval(selection.datetime, 'low'),
    },
    selection
  );

  const {
    isLoading: isCategoryDurationLoading,
    data: categoryDuration,
    isError: isCategoryDurationError,
  } = useEventsStatsQuery({
    eventView: categoryEventView,
    enabled: true,
    referrer: 'starfish-web-service.p95-duration-category-breakdown',
    initialData: {},
  });

  const orderArray: any[] = [];
  if (!isCategoryDurationError && !isCategoryDurationLoading) {
    Object.keys(categoryDuration).forEach(key => {
      const seriesData = categoryDuration?.[key];
      const label = key === '' ? NULL_SPAN_CATEGORY : key;
      orderArray.push([label, seriesData.order]);
      durationSeries[label] = {
        seriesName: label,
        data:
          seriesData?.data?.map(datum => {
            return {name: datum[0] * 1000, value: datum[1][0].count} as SeriesDataUnit;
          }) ?? [],
      };
    });
  }

  const tabOrder = [t('Overall')];
  orderArray.sort((a, b) => a[1] - b[1]).forEach(val => tabOrder.push(val[0]));

  useSynchronizeCharts();

  return (
    <MiniChartPanel title="Duration (P95)">
      <MinWidthButtonBar gap={1}>
        {tabOrder.map(label => {
          return (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setSelectedSeries(label);
              }}
              key={label}
              priority={selectedSeries === label ? 'primary' : undefined}
            >
              {label}
            </Button>
          );
        })}
      </MinWidthButtonBar>
      <Chart
        statsPeriod="24h"
        data={[durationSeries[selectedSeries]]}
        start=""
        end=""
        errored={isError}
        loading={
          selectedSeries === 'Overall'
            ? isServiceDurationLoading
            : isCategoryDurationLoading
        }
        utc={false}
        grid={{
          left: '0',
          right: '0',
          top: '8px',
          bottom: '0',
        }}
        height={175}
        chartColors={[P95_COLOR]}
        isLineChart
        definedAxisTicks={6}
        aggregateOutputFormat="duration"
        tooltipFormatterOptions={{
          valueFormatter: value =>
            tooltipFormatterUsingAggregateOutputType(value, 'duration'),
        }}
      />
    </MiniChartPanel>
  );
}

const MinWidthButtonBar = styled(ButtonBar)`
  width: min-content;
  margin-bottom: ${space(1)};
`;
