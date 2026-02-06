import {Component} from 'react';
import type {Theme} from '@emotion/react';
import {withTheme} from '@emotion/react';
import type {
  LineSeriesOption,
  MarkAreaComponentOption,
  MarkLineComponentOption,
  SeriesOption,
} from 'echarts';
import moment from 'moment-timezone';

import MarkArea from 'sentry/components/charts/components/markArea';
import MarkLine from 'sentry/components/charts/components/markLine';
import AreaSeries from 'sentry/components/charts/series/areaSeries';
import LineSeries from 'sentry/components/charts/series/lineSeries';
import {t} from 'sentry/locale';
import type {DataCategoryInfo} from 'sentry/types/core';
import type {UsageChartProps} from 'sentry/views/organizationStats/usageChart';
import UsageChart, {ChartDataTransform} from 'sentry/views/organizationStats/usageChart';
import {getDateFromMoment} from 'sentry/views/organizationStats/usageChart/utils';

import type {SpikeDetails, SpikeThresholds} from 'getsentry/views/spikeProtection/types';

import {getDateFromString, getOngoingSpikeInterval, getSpikeInterval} from './utils';

type SpikeProtectionUsageChartProps = {
  dataCategoryInfo: DataCategoryInfo;
  isLoading: boolean;
  spikeThresholds: SpikeThresholds;
  storedSpikes: SpikeDetails[];
  theme: Theme;
} & UsageChartProps;

class SpikeProtectionUsageChart extends Component<SpikeProtectionUsageChartProps> {
  get spikeThresholdSeries() {
    const {
      usageDateShowUtc,
      usageDateInterval,
      spikeThresholds,
      dataCategoryInfo,
      theme,
    } = this.props;

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

    return LineSeries({
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
  }

  get spikeRegionSeries() {
    const {storedSpikes, dataCategoryInfo, spikeThresholds, theme} = this.props;

    const formattedStoredSpikes: SpikeDetails[] = [];
    if (storedSpikes) {
      // Format the stored spikes to show on the graph
      // Round down the start time and round up the end time
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
          // For an ongoing spike, assume the spike end is the end of the graph
          // for visualization purposes
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

    const {usageDateShowUtc, usageDateInterval} = this.props;
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

    return AreaSeries({
      name: t('Spikes'),
      type: 'line',
      markArea: MarkArea({
        emphasis: {itemStyle: {color: theme.colors.red400}},
        data: spikeAreaData,
        itemStyle: {color: theme.colors.red200, opacity: 0.2},
        silent: true,
      }),
      markLine: MarkLine({
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
  }

  get isThresholdRelevant(): boolean {
    const {usageStats, spikeThresholds, dataCategoryInfo} = this.props;

    const spikeThresholdData = spikeThresholds?.groups?.find(
      group => group.billing_metric === dataCategoryInfo?.uid
    )?.threshold;

    if (!spikeThresholdData) {
      return false;
    }

    const maxThreshold = Math.max(...spikeThresholdData.filter(v => v > 0));
    if (maxThreshold <= 0) {
      return false;
    }

    let maxUsage = 0;
    const seriesKeys = [
      'accepted',
      'filtered',
      'rateLimited',
      'invalid',
      'clientDiscard',
      'projected',
    ] as const;
    for (const key of seriesKeys) {
      const series = (usageStats as any)[key];
      if (Array.isArray(series)) {
        for (const point of series) {
          const val = point?.value?.[1] ?? 0;
          if (typeof val === 'number' && val > maxUsage) {
            maxUsage = val;
          }
        }
      }
    }

    return maxUsage >= maxThreshold * 0.9;
  }

  get chartSeries() {
    const chartSeries: SeriesOption[] = [];
    const {spikeThresholds, dataTransform} = this.props;
    if (dataTransform === ChartDataTransform.CUMULATIVE) {
      return chartSeries;
    }
    if (spikeThresholds) {
      chartSeries.push(this.spikeThresholdSeries);
      chartSeries.push(this.spikeRegionSeries);
    }
    return chartSeries;
  }

  render() {
    const {isLoading, legendSelected} = this.props;
    const mergedLegendSelected = this.isThresholdRelevant
      ? legendSelected
      : {[t('Spike Protection Threshold')]: false, ...legendSelected};
    return (
      <UsageChart
        {...this.props}
        isLoading={isLoading}
        chartSeries={this.chartSeries}
        legendSelected={mergedLegendSelected}
      />
    );
  }
}

export default withTheme(SpikeProtectionUsageChart);
