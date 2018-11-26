import 'echarts/lib/component/tooltip';

import {getFormattedDate} from 'app/utils/dates';
import {truncationFormatter} from '../utils';

function formatAxisLabel(value, isTimestamp, utc) {
  if (!isTimestamp) {
    return value;
  }

  return getFormattedDate(value, 'MMM D, YYYY', utc);
}

function getFormatter({filter, isGroupedByDate, truncate, utc}) {
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
      formatAxisLabel(seriesParams[0].axisValueLabel, isGroupedByDate, utc);
    return [
      `<div>${truncationFormatter(label, truncate)}</div>`,
      seriesParams
        .filter(getFilter)
        .map(
          s =>
            `<div>${s.marker} ${truncationFormatter(s.seriesName, truncate)}:  ${s
              .data[1]}</div>`
        )
        .join(''),
    ].join('');
  };
}

export default function Tooltip(
  {filter, isGroupedByDate, formatter, truncate, utc, ...props} = {}
) {
  formatter = formatter || getFormatter({filter, isGroupedByDate, truncate, utc});

  return {
    show: true,
    trigger: 'axis',
    formatter,
    ...props,
  };
}
