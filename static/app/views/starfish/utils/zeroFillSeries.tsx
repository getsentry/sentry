import moment from 'moment';

import {Series} from 'sentry/types/echarts';

export function zeroFillSeries(
  series: Series,
  interval: moment.Duration,
  startTime?: moment.Moment
): Series {
  if (!series?.data?.length) {
    return series;
  }

  const firstDatum = series.data[0];
  const dateFormat = moment(firstDatum.name).creationData().format?.toString();

  if (!dateFormat) {
    return series;
  }

  const newData = [firstDatum];

  const seriesData = startTime
    ? [
        {value: 0, name: startTime.format(dateFormat)},
        ...series.data,
        moment().format(dateFormat),
      ]
    : [series.data, moment().format(dateFormat)];

  let currentDatum, nextDatum, lastSeenDate, nextDate, diff;
  for (let index = 1; index < seriesData.length; index++) {
    currentDatum = seriesData[index - 1];
    nextDatum = seriesData[index];

    lastSeenDate = moment(currentDatum.name);
    nextDate = moment(nextDatum.name);

    diff = moment.duration(nextDate.diff(lastSeenDate));

    while (diff.asMilliseconds() > interval.asMilliseconds()) {
      // The gap between the two datapoints is more than the intended interval!
      // We need to fill 0s
      lastSeenDate.add(interval);

      newData.push({
        value: 0,
        name: moment(lastSeenDate).format(dateFormat),
      });

      diff = moment.duration(moment(nextDatum.name).diff(lastSeenDate));
    }

    // Push the next datapoint
    newData.push({
      ...nextDatum,
      name: moment(nextDatum.name).format(dateFormat),
    });
  }

  return {
    ...series,
    data: newData,
  };
}
