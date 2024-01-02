import 'echarts/lib/component/tooltip';

import {Theme, useTheme} from '@emotion/react';
import type {TooltipComponentFormatterCallback, TooltipComponentOption} from 'echarts';
import moment from 'moment';

import BaseChart from 'sentry/components/charts/baseChart';
import {t} from 'sentry/locale';
import {DataPoint} from 'sentry/types/echarts';
import {getFormattedDate, getTimeFormat} from 'sentry/utils/dates';
import toArray from 'sentry/utils/toArray';

import {truncationFormatter} from '../utils';

type ChartProps = React.ComponentProps<typeof BaseChart>;

export function defaultFormatAxisLabel(
  value: number,
  isTimestamp: boolean,
  utc: boolean,
  showTimeInTooltip: boolean,
  addSecondsToTimeFormat: boolean,
  bucketSize?: number
) {
  if (!isTimestamp) {
    return value;
  }

  const formatOptions = {local: !utc};

  const timeFormat = showTimeInTooltip
    ? getTimeFormat({seconds: addSecondsToTimeFormat})
    : '';

  if (!bucketSize) {
    const format = `MMM D, YYYY ${timeFormat} z`.trim();
    return getFormattedDate(value, format, formatOptions);
  }

  const now = moment();
  const bucketStart = moment(value);
  const bucketEnd = moment(value + bucketSize);

  const showYear = now.year() !== bucketStart.year() || now.year() !== bucketEnd.year();
  const showEndDate = bucketStart.date() !== bucketEnd.date();

  const formatStart = `MMM D${showYear ? ', YYYY' : ''} ${timeFormat}`.trim();

  const formatEndDate = showEndDate ? `MMM D${showYear ? ', YYYY' : ''} ` : '';
  const formatEnd = `${formatEndDate} ${timeFormat}`.trim();

  const start = getFormattedDate(bucketStart, formatStart, formatOptions);
  const end = getFormattedDate(bucketEnd, formatEnd, formatOptions);
  const timezone = getFormattedDate(bucketEnd, 'z', formatOptions);

  return `${start} — ${end} (${timezone})`;
}

function defaultValueFormatter(value: string | number) {
  if (typeof value === 'number') {
    return value.toLocaleString();
  }

  return value;
}

function defaultNameFormatter(value: string) {
  return value;
}

function defaultMarkerFormatter(value: string) {
  return value;
}

function getSeriesValue(series: any, offset: number) {
  if (!series.data) {
    return undefined;
  }
  if (Array.isArray(series.data)) {
    return series.data[offset];
  }
  if (Array.isArray(series.data.value)) {
    return series.data.value[offset];
  }

  return undefined;
}

type NeededChartProps = 'isGroupedByDate' | 'showTimeInTooltip' | 'utc' | 'bucketSize';

type TooltipFormatters =
  | 'truncate'
  | 'filter'
  | 'formatAxisLabel'
  | 'valueFormatter'
  | 'nameFormatter'
  | 'markerFormatter';

export type TooltipSubLabel = {
  data: DataPoint[];
  label: string;
  parentLabel: string;
};

export type FormatterOptions = Pick<
  NonNullable<ChartProps['tooltip']>,
  TooltipFormatters
> &
  Pick<ChartProps, NeededChartProps> & {
    /**
     * If true seconds will be added to the Axis label time format
     */
    addSecondsToTimeFormat?: boolean;
    /**
     * Limit the number of series rendered in the tooltip and display "+X more".
     */
    limit?: number;
    /**
     * Array containing data that is used to display indented sublabels.
     */
    subLabels?: TooltipSubLabel[];
  };

export function getFormatter({
  filter,
  isGroupedByDate,
  showTimeInTooltip,
  truncate,
  formatAxisLabel,
  utc,
  bucketSize,
  valueFormatter = defaultValueFormatter,
  nameFormatter = defaultNameFormatter,
  markerFormatter = defaultMarkerFormatter,
  subLabels = [],
  addSecondsToTimeFormat = false,
  limit,
}: FormatterOptions): TooltipComponentFormatterCallback<any> {
  const getFilter = (seriesParam: any) => {
    // Series do not necessarily have `data` defined, e.g. releases don't have `data`, but rather
    // has a series using strictly `markLine`s.
    // However, real series will have `data` as a tuple of (label, value) or be
    // an object with value/label keys.
    const value = getSeriesValue(seriesParam, 0);
    if (typeof filter === 'function') {
      return filter(value, seriesParam);
    }

    return true;
  };

  return seriesParamsOrParam => {
    // If this is a tooltip for the axis, it will include all series for that axis item.
    // In this case seriesParamsOrParam will be of type `Object[]`
    //
    // Otherwise, it will be an `Object`, and is a tooltip for a single item
    const axisFormatterOrDefault = formatAxisLabel || defaultFormatAxisLabel;

    // Special tooltip if component is a `markPoint`
    if (
      !Array.isArray(seriesParamsOrParam) &&
      // TODO(ts): The EChart types suggest that this can _only_ be `series`,
      //           but assuming this code is correct (which I have not
      //           verified) their types may be wrong.
      (seriesParamsOrParam.componentType as unknown) === 'markPoint'
    ) {
      const timestamp = seriesParamsOrParam.data.coord[0] as number;
      const label = axisFormatterOrDefault(
        timestamp,
        !!isGroupedByDate,
        !!utc,
        !!showTimeInTooltip,
        addSecondsToTimeFormat,
        bucketSize,
        seriesParamsOrParam
      );
      // eCharts sets seriesName as null when `componentType` !== 'series'
      const truncatedName = truncationFormatter(
        seriesParamsOrParam.data.labelForValue,
        truncate
      );
      const formattedValue = valueFormatter(
        seriesParamsOrParam.data.coord[1],
        seriesParamsOrParam.name
      );

      return [
        '<div class="tooltip-series">',
        `<div>
          <span class="tooltip-label"><strong>${seriesParamsOrParam.name}</strong></span>
          ${truncatedName}: ${formattedValue}
        </div>`,
        '</div>',
        `<div class="tooltip-footer">${label}</div>`,
        '</div>',
      ].join('');
    }

    let seriesParams = toArray(seriesParamsOrParam);

    // If axis, timestamp comes from axis, otherwise for a single item it is defined in the data attribute.
    // The data attribute is usually a list of [name, value] but can also be an object of {name, value} when
    // there is item specific formatting being used.
    const timestamp = Array.isArray(seriesParamsOrParam)
      ? seriesParams[0].value[0]
      : getSeriesValue(seriesParams[0], 0);

    const date =
      seriesParams.length &&
      axisFormatterOrDefault(
        timestamp,
        !!isGroupedByDate,
        !!utc,
        !!showTimeInTooltip,
        addSecondsToTimeFormat,
        bucketSize,
        seriesParamsOrParam
      );

    if (limit) {
      const originalLength = seriesParams.length;
      seriesParams = seriesParams.sort((a, b) => b.value[1] - a.value[1]).slice(0, limit);
      if (originalLength > limit) {
        seriesParams.push({
          seriesName: `+${originalLength - limit} more`,
          value: '',
          color: 'transparent',
        });
      }
    }

    const {series, total} = seriesParams.filter(getFilter).reduce(
      (acc, serie) => {
        const formattedLabel = nameFormatter(
          truncationFormatter(serie.seriesName ?? '', truncate)
        );

        const value = valueFormatter(getSeriesValue(serie, 1), serie.seriesName, serie);

        const marker = markerFormatter(serie.marker ?? '', serie.seriesName);

        const filteredSubLabels = subLabels.filter(
          subLabel => subLabel.parentLabel === serie.seriesName
        );

        if (filteredSubLabels.length) {
          const labelWithSubLabels = [
            `<div><span class="tooltip-label">${marker} <strong>${formattedLabel}</strong></span> <strong>${value}</strong></div>`,
          ];

          for (const subLabel of filteredSubLabels) {
            const serieValue = subLabel.data[serie.dataIndex].value;

            labelWithSubLabels.push(
              `<div><span class="tooltip-label tooltip-label-indent"><strong>${
                subLabel.label
              }</strong></span> ${valueFormatter(serieValue)}</div>`
            );

            acc.total = acc.total + subLabel.data[serie.dataIndex].value;
          }

          acc.series.push(labelWithSubLabels.join(''));
          return acc;
        }

        acc.total = acc.total + getSeriesValue(serie, 1);

        if (subLabels.length > 0) {
          acc.series.push(
            `<div><span class="tooltip-label">${marker} <strong>${formattedLabel}</strong></span> <strong>${value}</strong></div>`
          );
        } else {
          acc.series.push(
            `<div><span class="tooltip-label">${marker} <strong>${formattedLabel}</strong></span> ${value}</div>`
          );
        }

        return acc;
      },
      {
        series: [],
        total: 0,
      }
    );

    if (subLabels.length > 0) {
      return [
        `<div class="tooltip-series">${series.join('')}</div>`,
        '<div class="tooltip-footer">',
        `<div><strong>${t('Date')}:</strong> ${date}</div>`,
        `<div><strong>${t('Total')}:</strong> ${valueFormatter(total)}</div>`,
        '</div>',
        '<div class="tooltip-arrow"></div>',
      ].join('');
    }

    return [
      `<div class="tooltip-series">${series.join('')}</div>`,
      '<div class="tooltip-footer tooltip-footer-centered">',
      date,
      '</div>',
      '<div class="tooltip-arrow"></div>',
    ].join('');
  };
}

type Props = ChartProps['tooltip'] &
  Pick<ChartProps, NeededChartProps> &
  Pick<FormatterOptions, 'addSecondsToTimeFormat'> & {
    /**
     * An ID for the chart when using renderToBody to portal the tooltip.
     * A reference to the chart is needed to calculate the tooltip position.
     */
    chartId?: string;
  };

export function computeChartTooltip(
  {
    filter,
    isGroupedByDate,
    showTimeInTooltip,
    addSecondsToTimeFormat,
    formatter,
    truncate,
    utc,
    bucketSize,
    formatAxisLabel,
    valueFormatter,
    nameFormatter,
    markerFormatter,
    hideDelay,
    subLabels,
    chartId,
    ...props
  }: Props,
  theme: Theme
): TooltipComponentOption {
  formatter =
    formatter ||
    getFormatter({
      filter,
      isGroupedByDate,
      showTimeInTooltip,
      addSecondsToTimeFormat,
      truncate,
      utc,
      bucketSize,
      formatAxisLabel,
      valueFormatter,
      nameFormatter,
      markerFormatter,
      subLabels,
    });

  return {
    show: true,
    trigger: 'item',
    backgroundColor: `${theme.backgroundElevated}`,
    borderWidth: 0,
    extraCssText: `box-shadow: 0 0 0 1px ${theme.translucentBorder}, ${theme.dropShadowHeavy}`,
    transitionDuration: 0,
    padding: 0,
    className: 'tooltip-container',
    // Default hideDelay in echarts docs is 100ms
    hideDelay: hideDelay || 100,
    /**
     * @link https://echarts.apache.org/en/option.html#tooltip.position
     *
     * @param pos mouse position
     * @param _params same as formatter
     * @param dom dom object of tooltip
     * @param _rec graphic elements
     * @param _size The size of dom echarts container.
     */
    position(pos, _params, dom, _rec, size) {
      // Types seem to be broken on dom
      dom = dom as HTMLDivElement;
      // Center the tooltip slightly above the cursor.
      const [tipWidth, tipHeight] = size.contentSize;

      let parentNode: Element = document.body;
      if (dom.parentNode instanceof Element) {
        parentNode = dom.parentNode;
      }

      const chartElement: Element =
        props.appendToBody && chartId
          ? document.getElementById(chartId) ?? parentNode
          : parentNode;

      // Get the left offset of the tip container (the chart)
      // so that we can estimate overflows
      const chartLeft = chartElement.getBoundingClientRect().left ?? 0;

      // Determine the new left edge.
      let leftPos = Number(pos[0]) - tipWidth / 2;
      // And the right edge taking into account the chart left offset
      const rightEdge = chartLeft + Number(pos[0]) + tipWidth / 2;

      let arrowPosition: string | undefined;
      if (rightEdge >= window.innerWidth - 20) {
        // If the tooltip would leave viewport on the right, pin it.
        leftPos -= rightEdge - window.innerWidth + 20;
        arrowPosition = `${Number(pos[0]) - leftPos}px`;
      } else if (leftPos + chartLeft - 20 <= 0) {
        // If the tooltip would leave viewport on the left, pin it.
        leftPos = chartLeft * -1 + 20;
        arrowPosition = `${Number(pos[0]) - leftPos}px`;
      } else {
        // Tooltip not near the window edge, reset position
        arrowPosition = '50%';
      }

      const arrow = dom.querySelector<HTMLDivElement>('.tooltip-arrow');
      if (arrow) {
        arrow.style.left = arrowPosition;
      }

      return {left: leftPos, top: Number(pos[1]) - tipHeight - 20};
    },
    formatter,
    ...props,
  };
}

export function ChartTooltip(props: Props = {}): TooltipComponentOption {
  const theme = useTheme();
  return computeChartTooltip(props, theme);
}
