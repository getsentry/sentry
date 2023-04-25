import moment from 'moment';

import {Series, SeriesDataUnit} from 'sentry/types/echarts';

export function zeroFillSeries(
  series: Series,
  interval: moment.Duration,
  startTime?: moment.Moment,
  endTime?: moment.Moment
): Series {
  if (!series?.data?.length) {
    return series;
  }

  const firstDatum = series.data[0];
  const lastDatum = series.data[series.data.length - 1];
  const dateFormat = moment(firstDatum.name).creationData().format?.toString();

  if (!dateFormat) {
    return series;
  }

  const newData: SeriesDataUnit[] = [];

  const startTimeNearestInterval = startTime && roundUpToNearest12HourInterval(startTime);
  const endTimeNearestInterval = endTime && roundDownToNearest12HourInterval(endTime);

  const seriesData = [
    ...(startTimeNearestInterval &&
    startTimeNearestInterval.diff(moment(firstDatum.name)) < 0
      ? [{value: 0, name: startTimeNearestInterval.format(dateFormat)}]
      : []),
    ...series.data,
    ...(endTimeNearestInterval && endTimeNearestInterval.diff(moment(lastDatum.name)) > 0
      ? [{value: 0, name: endTimeNearestInterval.format(dateFormat)}]
      : []),
  ];

  let currentDatum, nextDatum, lastSeenDate, nextDate, diff;
  for (let index = 0; index < seriesData.length - 1; index++) {
    // Push the first datapoint
    if (index === 0) {
      newData.push({
        ...seriesData[index],
        name: moment(seriesData[index].name).format(dateFormat),
      });
    }

    currentDatum = seriesData[index];
    nextDatum = seriesData[index + 1];

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

function roundUpToNearest12HourInterval(time: moment.Moment) {
  return roundDownToNearest12HourInterval(time.clone().add(12, 'hour'));
}

function roundDownToNearest12HourInterval(time: moment.Moment) {
  const hour = time.hour();
  const nearestDay = time.clone().startOf('day');
  if (hour < 12) {
    return nearestDay;
  }
  return nearestDay.add(12, 'hour');
}
