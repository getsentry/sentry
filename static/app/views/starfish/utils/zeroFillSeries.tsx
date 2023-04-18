import moment from 'moment';

import {Series} from 'sentry/types/echarts';

export function zeroFillSeries(series: Series, interval: moment.Duration): Series {
  if (!series?.data?.length) {
    return series;
  }

  const firstDatum = series.data[0];
  const dateFormat = moment(firstDatum.name).creationData().format?.toString();

  if (!dateFormat) {
    return series;
  }

  const newData = [firstDatum];

  let currentDatum, nextDatum, lastSeenDate, nextDate, diff;
  for (let index = 1; index < series.data.length; index++) {
    currentDatum = series.data[index - 1];
    nextDatum = series.data[index];

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
