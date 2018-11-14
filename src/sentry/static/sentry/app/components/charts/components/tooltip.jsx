import moment from 'moment';
import 'echarts/lib/component/tooltip';
import {truncationFormatter} from '../utils';

function formatAxisLabel(value, isTimestamp) {
  if (!isTimestamp) {
    return value;
  }

  return moment.utc(value).format('MMM D, YYYY');
}

function getFormatter({filter, isGroupedByDate, truncate}) {
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
      formatAxisLabel(seriesParams[0].axisValueLabel, isGroupedByDate);
    return [
      `<div>${truncate ? truncationFormatter(label, truncate) : label}</div>`,
      seriesParams
        .filter(getFilter)
        .map(
          s =>
            `<div>${s.marker} ${truncate
              ? truncationFormatter(s.seriesName, truncate)
              : s.seriesName}:  ${s.data[1]}</div>`
        )
        .join(''),
    ].join('');
  };
}

export default function Tooltip(
  {filter, isGroupedByDate, formatter, truncate, ...props} = {}
) {
  formatter = formatter || getFormatter({filter, isGroupedByDate, truncate});

  return {
    show: true,
    trigger: 'axis',
    formatter,
    ...props,
  };
}
