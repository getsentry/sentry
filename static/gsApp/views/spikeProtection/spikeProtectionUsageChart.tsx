import {Component} from 'react';
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
import theme from 'sentry/utils/theme';
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
} & UsageChartProps;

class SpikeProtectionUsageChart extends Component<SpikeProtectionUsageChartProps> {
  get spikeThresholdSeries() {
    const {usageDateShowUtc, usageDateInterval, spikeThresholds, dataCategoryInfo} =
      this.props;

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
            threshold !== 0 ? threshold : '--',
          ],
        };
      }
    );

    return LineSeries({
      name: t('Spike Protection Threshold'),
      lineStyle: {type: 'dotted'},
      color: theme.gray300,
      data: seriesData,
      legendHoverLink: false,
      zlevel: 2,
      tooltip: {
        show: false,
      },
    });
  }

  get spikeRegionSeries() {
    const {storedSpikes, dataCategoryInfo, spikeThresholds} = this.props;

    const formattedStoredSpikes: SpikeDetails[] = [];
    if (storedSpikes) {
      // Format the stored spikes to show on the graph
      // Round down the start time and round up the end time
      storedSpikes.forEach(spike => {
        const spikeDates = {startDate: '', endDate: ''};
        if (!spike.end) {
          // For an ongoing spike, assume the spike end is the end of the graph
          // for visualization purposes
          const {startDate, endDate} = getOngoingSpikeInterval(
            spikeThresholds.intervals,
            getDateFromString(spike.start)
          );
          spikeDates.startDate = startDate!;
          spikeDates.endDate = endDate!;
        } else {
          const {startDate, endDate} = getSpikeInterval(
            spikeThresholds.intervals,
            getDateFromString(spike.start),
            getDateFromString(spike.end)
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
        emphasis: {itemStyle: {color: theme.red300}},
        data: spikeAreaData,
        itemStyle: {color: theme.red200, opacity: 0.2},
        silent: true,
      }),
      markLine: MarkLine({
        label: {show: false},
        silent: true,
        data: spikeLineData,
        itemStyle: {color: theme.red200},
        lineStyle: {type: 'solid'},
      }),
      itemStyle: {
        color: theme.red100,
        borderColor: theme.red300,
        borderWidth: 0.1,
      },
      zlevel: 0,
      data: [],
    });
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
    const {isLoading} = this.props;
    return (
      <UsageChart {...this.props} isLoading={isLoading} chartSeries={this.chartSeries} />
    );
  }
}

export default SpikeProtectionUsageChart;
