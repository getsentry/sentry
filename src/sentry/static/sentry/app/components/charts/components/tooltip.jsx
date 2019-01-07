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
    const value = seriesParam.data[1];
    if (typeof filter === 'function') {
      return filter(value);
    }

    return true;
  };

  return seriesParams => {
    const label =
      seriesParams.length &&
      (formatAxisLabel || defaultFormatAxisLabel)(
        seriesParams[0].axisValueLabel,
        isGroupedByDate,
        utc
      );
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
    trigger: 'axis',
    formatter,
    ...props,
  };
}
