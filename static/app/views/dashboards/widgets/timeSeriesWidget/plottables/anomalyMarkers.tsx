import type {
  CustomSeriesOption,
  CustomSeriesRenderItem,
  MarkAreaComponentOption,
  MarkLineComponentOption,
  SeriesOption,
} from 'echarts';

import type {Theme} from '@sentry/scraps/theme';

import {MarkArea} from 'sentry/components/charts/components/markArea';
import {markLine} from 'sentry/components/charts/components/markLine';
import {defaultFormatAxisLabel} from 'sentry/components/charts/components/tooltip';
import {t} from 'sentry/locale';
import {escape} from 'sentry/utils';
import type {TimeSeriesValueUnit} from 'sentry/views/dashboards/widgets/common/types';

import type {Plottable, PlottableTimeSeriesValueType} from './plottable';

/**
 * Height of the bar drawn along the bottom of the chart for each period. It
 * matches the monitor chart's anomaly markers.
 */
const MARKER_HEIGHT = 6;

/**
 * A run of consecutive anomalous points, in milliseconds
 */
export interface AnomalyPeriod {
  end: number;
  priority: 'high' | 'medium';
  start: number;
}

type AnomalyMarkersOptions = {
  /**
   * Copied from the chart's data series so the markers share its Y axis.
   * A different type would add a second Y axis.
   */
  dataType: PlottableTimeSeriesValueType;
  dataUnit: TimeSeriesValueUnit;
  periods: readonly AnomalyPeriod[];
};

type AnomalyMarkersPlottingOptions = {
  theme: Theme;
};

export function getAnomalyPriorityColor(
  priority: AnomalyPeriod['priority'],
  theme: Theme
): string {
  return priority === 'high' ? theme.colors.red400 : theme.colors.yellow400;
}

/**
 * Marks anomalous periods the way the monitor chart does: a bar along the
 * bottom of the chart and a line where each period starts, red for high
 * confidence and yellow for low confidence. A faint shading over each period
 * stands in for the monitor's hover highlight, which would block the chart's
 * zoom and selection here.
 */
export class AnomalyMarkers implements Plottable {
  periods: readonly AnomalyPeriod[];

  /** State variables required for Plottable interface */
  dataType: PlottableTimeSeriesValueType;
  dataUnit: TimeSeriesValueUnit;
  isEmpty: boolean;
  label = t('Anomalies');
  name = '__anomalies__';
  needsColor = false;
  start: number | null;
  end: number | null;

  constructor({periods, dataType, dataUnit}: AnomalyMarkersOptions) {
    this.periods = periods;
    this.dataType = dataType;
    this.dataUnit = dataUnit;
    this.isEmpty = periods.length === 0;
    this.start = this.isEmpty ? null : Math.min(...periods.map(period => period.start));
    this.end = this.isEmpty ? null : Math.max(...periods.map(period => period.end));
  }

  toMarkArea(theme: Theme): MarkAreaComponentOption {
    return MarkArea({
      silent: true,
      data: this.periods.map(period => [
        {
          xAxis: period.start,
          itemStyle: {
            color: getAnomalyPriorityColor(period.priority, theme),
            opacity: 0.08,
          },
        },
        {xAxis: period.end},
      ]),
    });
  }

  toMarkLine(theme: Theme): MarkLineComponentOption | undefined {
    return markLine({
      silent: true,
      animation: false,
      symbol: ['none', 'none'],
      label: {show: false},
      data: this.periods.map(period => ({
        xAxis: period.start,
        lineStyle: {
          color: getAnomalyPriorityColor(period.priority, theme),
          type: 'solid',
          width: 1,
          opacity: 0.8,
        },
      })),
    });
  }

  toSeries({theme}: AnomalyMarkersPlottingOptions): SeriesOption[] {
    if (this.isEmpty) {
      return [];
    }

    const periods = this.periods;

    // Draws one bar per period, pinned to the bottom of the plot area. The
    // series data are plain objects with no `value`, so they don't stretch
    // either axis.
    const renderBar: CustomSeriesRenderItem = (params, api) => {
      const period = periods[params.dataIndex];
      const startX = period ? api.coord([period.start, 0])?.[0] : undefined;
      const endX = period ? api.coord([period.end, 0])?.[0] : undefined;
      const coordSys = params.coordSys as unknown as {
        height: number;
        width: number;
        x: number;
        y: number;
      };

      if (!period || startX === undefined || endX === undefined) {
        return {type: 'group', children: []};
      }

      // Clip to the plot area so periods at the edges don't overflow it
      const left = Math.max(startX, coordSys.x);
      const right = Math.min(endX, coordSys.x + coordSys.width);

      return {
        type: 'rect',
        silent: true,
        shape: {
          x: left,
          y: coordSys.y + coordSys.height - MARKER_HEIGHT,
          width: Math.max(right - left, 2),
          height: MARKER_HEIGHT,
          r: [0, 2, 2, 0],
        },
        style: {fill: getAnomalyPriorityColor(period.priority, theme)},
      };
    };

    const series: CustomSeriesOption = {
      type: 'custom',
      name: this.name,
      silent: true,
      animation: false,
      renderItem: renderBar,
      data: periods.map(period => ({...period})),
      markArea: this.toMarkArea(theme),
      markLine: this.toMarkLine(theme),
      // Used for the legend swatch
      color: theme.colors.red400,
    };

    return [series];
  }
}

type SeriesDetailsRenderer = (seriesNames: string[], timestamp: number) => string;

function formatTime(timestamp: number, utc: boolean) {
  return defaultFormatAxisLabel(timestamp, true, utc, true, false);
}

/**
 * Adds the anomaly's start and end times to the chart tooltip when hovering an
 * anomalous bucket, like the monitor chart's anomaly tooltip.
 */
export function makeAnomalyTooltipDetails({
  anomalousTimestamps,
  periods,
  theme,
  utc,
}: {
  /**
   * Timestamps (ms) of the buckets Seer flagged
   */
  anomalousTimestamps: ReadonlySet<number>;
  periods: readonly AnomalyPeriod[];
  theme: Theme;
  utc: boolean;
}): SeriesDetailsRenderer | undefined {
  if (periods.length === 0) {
    return undefined;
  }

  return (_seriesNames, timestamp) => {
    if (!anomalousTimestamps.has(timestamp)) {
      return '';
    }
    const period = periods.find(
      candidate => candidate.start <= timestamp && timestamp <= candidate.end
    );
    if (!period) {
      return '';
    }

    const color = getAnomalyPriorityColor(period.priority, theme);
    const dividerStyle = [
      `border-top: solid 1px ${theme.tokens.border.secondary}`,
      `margin: ${theme.space.md} calc(-1 * ${theme.space.xl}) 0`,
      `padding: ${theme.space.md} ${theme.space.xl} 0`,
    ].join('; ');
    const title =
      period.priority === 'high'
        ? t('Anomaly (high confidence)')
        : t('Anomaly (low confidence)');

    return [
      `<div style="${dividerStyle}">`,
      `<div><span class="tooltip-label" style="color: ${color}"><strong>${escape(title)}</strong></span></div>`,
      `<div><span class="tooltip-label">${escape(t('Started'))}</span> ${escape(String(formatTime(period.start, utc)))}</div>`,
      `<div><span class="tooltip-label">${escape(t('Ended'))}</span> ${escape(String(formatTime(period.end, utc)))}</div>`,
      '</div>',
    ].join('');
  };
}
