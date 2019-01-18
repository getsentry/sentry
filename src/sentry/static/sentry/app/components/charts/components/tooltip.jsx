import 'echarts/lib/component/tooltip';

import {getFormattedDate} from 'app/utils/dates';
import {truncationFormatter} from '../utils';

function defaultFormatAxisLabel(value, isTimestamp, utc) {
  if (!isTimestamp) {
    return value;
  }

  return getFormattedDate(value, 'MMM D, YYYY', utc);
}

function valueFormatter(value) {
  if (typeof value === 'number') {
    return value.toLocaleString();
  }

  return value;
}

function getFormatter({filter, isGroupedByDate, truncate, formatAxisLabel, utc}) {
  const getFilter = seriesParam => {
    // Series do not necessarily have `data` defined, e.g. releases don't have `data`, but rather
    // has a series using strictly `markLine`s.
    // However, real series will have `data` as a tuple of (key, value)
    const value = seriesParam.data && seriesParam.data.length && seriesParam.data[1];
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
    const seriesParams = isAxisItem ? seriesParamsOrParam : [seriesParamsOrParam];

    // If axis, timestamp comes from axis, otherwise for a single item it is defined in its data
    const timestamp = isAxisItem ? seriesParams[0].axisValue : seriesParams[0]?.data[0];

    const label =
      seriesParams.length &&
      (formatAxisLabel || defaultFormatAxisLabel)(timestamp, isGroupedByDate, utc);

    return [
      `<div>${truncationFormatter(label, truncate)}</div>`,
      seriesParams
        .filter(getFilter)
        .map(
          s =>
            `<div>${s.marker} ${truncationFormatter(
              s.seriesName,
              truncate
            )}:  ${valueFormatter(s.data[1])}</div>`
        )
        .join(''),
    ].join('');
  };
}

export default function Tooltip(
  {filter, isGroupedByDate, formatter, truncate, utc, formatAxisLabel, ...props} = {}
) {
  formatter =
    formatter || getFormatter({filter, isGroupedByDate, truncate, utc, formatAxisLabel});

  return {
    show: true,
    trigger: 'item',
    formatter,
    ...props,
  };
}
