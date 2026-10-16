import {useTheme} from '@emotion/react';
import type {
  LineSeriesOption,
  MarkAreaComponentOption,
  MarkLineComponentOption,
  SeriesOption,
} from 'echarts';
import moment from 'moment-timezone';

import {MarkArea} from 'sentry/components/charts/components/markArea';
import {markLine} from 'sentry/components/charts/components/markLine';
import {createAreaSeries} from 'sentry/components/charts/series/areaSeries';
import {createLineSeries} from 'sentry/components/charts/series/lineSeries';
import {t} from 'sentry/locale';
import type {DataCategoryInfo} from 'sentry/types/core';
import type {UsageChartProps} from 'sentry/views/organizationStats/usageChart';
import {ChartDataTransform, UsageChart} from 'sentry/views/organizationStats/usageChart';
import {getDateFromMoment} from 'sentry/views/organizationStats/usageChart/utils';

import type {SpikeDetails, SpikeThresholds} from 'getsentry/views/spikeProtection/types';

import {getDateFromString, getOngoingSpikeInterval, getSpikeInterval} from './utils';

type SpikeProtectionUsageChartProps = {
  dataCategoryInfo: DataCategoryInfo;
  isLoading: boolean;
  spikeThresholds: SpikeThresholds;
  storedSpikes: SpikeDetails[];
} & UsageChartProps;

export function SpikeProtectionUsageChart(props: SpikeProtectionUsageChartProps) {
  const theme = useTheme();
  const {
    usageDateShowUtc,
    usageDateInterval,
    spikeThresholds,
    dataCategoryInfo,
    storedSpikes,
    dataTransform,
    isLoading,
  } = props;

  const spikeThresholdData = spikeThresholds?.groups?.find(
    group => group.billing_metric === dataCategoryInfo?.uid
  )?.threshold;
  const seriesData: LineSeriesOption['data'] = spikeThresholds.intervals.map(
    (interval, i) => {
      const dateTime = moment(interval);
      const threshold = spikeThresholdData?.[i] ?? 0;
      return {
        value: [
          getDateFromMoment(dateTime, usageDateInterval, usageDateShowUtc),
          threshold === 0 ? '--' : threshold,
        ],
      };
    }
  );

  const spikeThresholdSeries = createLineSeries({
    name: t('Spike Protection Threshold'),
    lineStyle: {type: 'dotted'},
    color: theme.colors.gray400,
    data: seriesData,
    legendHoverLink: false,
    zlevel: 2,
    tooltip: {
      show: false,
    },
  });

  const formattedStoredSpikes: SpikeDetails[] = [];
  if (storedSpikes) {
    storedSpikes.forEach(spike => {
      const spikeDates = {startDate: '', endDate: ''};
      if (spike.end) {
        const {startDate, endDate} = getSpikeInterval(
          spikeThresholds.intervals,
          getDateFromString(spike.start),
          getDateFromString(spike.end)
        );
        spikeDates.startDate = startDate!;
        spikeDates.endDate = endDate!;
      } else {
        const {startDate, endDate} = getOngoingSpikeInterval(
          spikeThresholds.intervals,
          getDateFromString(spike.start)
        );
        spikeDates.startDate = startDate!;
        spikeDates.endDate = endDate!;
      }
      formattedStoredSpikes.push({
        start: spikeDates.startDate,
        end: spikeDates.endDate,
        dropped: spike.dropped,
        threshold: spike.threshold,
        dataCategory: spike.dataCategory,
      });
    });
  }

  const categorySpikes = formattedStoredSpikes.filter(
    spike => spike.dataCategory === dataCategoryInfo.name
  );

  const spikeAreaData: MarkAreaComponentOption['data'] = categorySpikes.map(
    ({start, end}) => {
      return [
        {xAxis: getDateFromMoment(moment(start), usageDateInterval, usageDateShowUtc)},
        {xAxis: getDateFromMoment(moment(end), usageDateInterval, usageDateShowUtc)},
      ];
    }
  );
  const spikeLineData: MarkLineComponentOption['data'] = categorySpikes.map(
    ({start}) => ({
      xAxis: getDateFromMoment(moment(start), usageDateInterval, usageDateShowUtc),
    })
  );

  const spikeRegionSeries = createAreaSeries({
    name: t('Spikes'),
    type: 'line',
    markArea: MarkArea({
      emphasis: {itemStyle: {color: theme.colors.red400}},
      data: spikeAreaData,
      itemStyle: {color: theme.colors.red200, opacity: 0.2},
      silent: true,
    }),
    markLine: markLine({
      label: {show: false},
      silent: true,
      data: spikeLineData,
      itemStyle: {color: theme.colors.red200},
      lineStyle: {type: 'solid'},
    }),
    itemStyle: {
      color: theme.colors.red100,
      borderColor: theme.colors.red400,
      borderWidth: 0.1,
    },
    zlevel: 0,
    data: [],
  });

  const chartSeries: SeriesOption[] = [];
  if (dataTransform !== ChartDataTransform.CUMULATIVE && spikeThresholds) {
    chartSeries.push(spikeThresholdSeries, spikeRegionSeries);
  }

  return <UsageChart {...props} isLoading={isLoading} chartSeries={chartSeries} />;
}
