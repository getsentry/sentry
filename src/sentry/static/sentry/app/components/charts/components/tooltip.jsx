import 'echarts/lib/component/tooltip';

import {getFormattedDate, getTimeFormat} from 'app/utils/dates';

import {truncationFormatter} from '../utils';

function defaultFormatAxisLabel(value, isTimestamp, utc, showTimeInTooltip) {
  if (!isTimestamp) {
    return value;
  }
  const format = `MMM D, YYYY ${showTimeInTooltip ? getTimeFormat() : ''}`.trim();

  return getFormattedDate(value, format, {local: !utc});
}

function defaultValueFormatter(value) {
  if (typeof value === 'number') {
    return value.toLocaleString();
  }

  return value;
}

function defaultNameFormatter(value) {
  return value;
}

function getSeriesValue(series, offset) {
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

function getFormatter({
  filter,
  isGroupedByDate,
  showTimeInTooltip,
  truncate,
  formatAxisLabel,
  utc,
  valueFormatter = defaultValueFormatter,
  nameFormatter = defaultNameFormatter,
}) {
  const getFilter = seriesParam => {
    // Series do not necessarily have `data` defined, e.g. releases don't have `data`, but rather
    // has a series using strictly `markLine`s.
    // However, real series will have `data` as a tuple of (label, value) or be
    // an object with value/label keys.
    const value = getSeriesValue(seriesParam, 0);
    if (typeof filter === 'function') {
      return filter(value);
    }

    return true;
  };

  return seriesParamsOrParam => {
    // If this is a tooltip for the axis, it will include all series for that axis item.
    // In this case seriesParamsOrParam will be of type `Object[]`
    //
    // Otherwise, it will be an `Object`, and is a tooltip for a single item
    const isAxisItem = Array.isArray(seriesParamsOrParam);
    const axisFormatterOrDefault = formatAxisLabel || defaultFormatAxisLabel;

    // Special tooltip if component is a `markPoint`
    if (!isAxisItem && seriesParamsOrParam.componentType === 'markPoint') {
      const timestamp = seriesParamsOrParam.data.coord[0];
      const label = axisFormatterOrDefault(
        timestamp,
        isGroupedByDate,
        utc,
        showTimeInTooltip
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
        `<div class="tooltip-date">${label}</div>`,
        '</div>',
      ].join('');
    }

    const seriesParams = isAxisItem ? seriesParamsOrParam : [seriesParamsOrParam];

    // If axis, timestamp comes from axis, otherwise for a single item it is defined in the data attribute.
    // The data attribute is usually a list of [name, value] but can also be an object of {name, value} when
    // there is item specific formatting being used.
    const timestamp = isAxisItem
      ? seriesParams[0].axisValue
      : getSeriesValue(seriesParams[0], 0);

    const label =
      seriesParams.length &&
      axisFormatterOrDefault(timestamp, isGroupedByDate, utc, showTimeInTooltip);

    return [
      '<div class="tooltip-series">',
      seriesParams
        .filter(getFilter)
        .map(s => {
          const formattedLabel = nameFormatter(
            truncationFormatter(s.seriesName, truncate)
          );
          const value = valueFormatter(getSeriesValue(s, 1), s.seriesName);
          return `<div><span class="tooltip-label">${s.marker} <strong>${formattedLabel}</strong></span> ${value}</div>`;
        })
        .join(''),
      '</div>',
      `<div class="tooltip-date">${label}</div>`,
      `<div class="tooltip-arrow"></div>`,
    ].join('');
  };
}

export default function Tooltip({
  filter,
  isGroupedByDate,
  showTimeInTooltip,
  formatter,
  truncate,
  utc,
  formatAxisLabel,
  valueFormatter,
  nameFormatter,
  ...props
} = {}) {
  formatter =
    formatter ||
    getFormatter({
      filter,
      isGroupedByDate,
      showTimeInTooltip,
      truncate,
      utc,
      formatAxisLabel,
      valueFormatter,
      nameFormatter,
    });

  return {
    show: true,
    trigger: 'item',
    backgroundColor: 'transparent',
    transitionDuration: 0,
    padding: 0,
    position(pos, _params, dom, _rec, _size) {
      // Center the tooltip slightly above the cursor.
      const tipWidth = dom.clientWidth;
      const tipHeight = dom.clientHeight;

      // Get the left offset of the tip container (the chart)
      // so that we can estimate overflows
      const chartLeft = dom.parentNode.getBoundingClientRect().left;

      // Determine the new left edge.
      let leftPos = pos[0] - tipWidth / 2;
      let arrowPosition = '50%';

      // And the right edge taking into account the chart left offset
      const rightEdge = chartLeft + pos[0] + tipWidth / 2;

      // If the tooltip would leave viewport on the right, pin it.
      // and adjust the arrow position.
      if (rightEdge >= window.innerWidth - 30) {
        leftPos -= rightEdge - window.innerWidth + 30;
        arrowPosition = `${pos[0] - leftPos}px`;
      }

      // If the tooltip would leave viewport on the left, pin it.
      if (leftPos + chartLeft - 20 <= 0) {
        leftPos = chartLeft * -1 + 20;
        arrowPosition = `${pos[0] - leftPos}px`;
      }

      // Reposition the arrow.
      const arrow = dom.querySelector('.tooltip-arrow');
      if (arrow) {
        arrow.style.left = arrowPosition;
      }

      return {left: leftPos, top: pos[1] - tipHeight - 20};
    },
    formatter,
    ...props,
  };
}
