import moment from 'moment';
import 'echarts/lib/component/tooltip';

const DEFAULT_TRUNCATE_LENGTH = 80;

// Truncates labels for tooltip
function truncateLabel(seriesName, truncate) {
  if (!truncate) {
    return seriesName;
  }

  let result = seriesName;
  let truncateLength = typeof truncate === 'number' ? truncate : DEFAULT_TRUNCATE_LENGTH;
  0;

  if (seriesName.length > truncateLength) {
    result = seriesName.substring(0, truncateLength) + '…';
  }
  return result;
}

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
      `<div>${truncateLabel(label, truncate)}</div>`,
      seriesParams
        .filter(getFilter)
        .map(
          s =>
            `<div>${s.marker} ${truncateLabel(s.seriesName, truncate)}:  ${s
              .data[1]}</div>`
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
