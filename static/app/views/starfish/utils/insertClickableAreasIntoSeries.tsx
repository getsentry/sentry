import MarkArea from 'sentry/components/charts/components/markArea';
import {LineChartSeries} from 'sentry/components/charts/lineChart';

export function insertClickableAreasIntoSeries(series: LineChartSeries[], color: string) {
  const {data} = series[0];
  const startTime = data[0].name;
  const endTime = data[data.length - 1].name;
  const intervals = divideIntoIntervals(startTime as number, endTime as number, 8);

  const areaMarkData = intervals.map(([start, end]) => [{xAxis: start}, {xAxis: end}]);

  series.push({
    seriesName: 'Clickable Area',
    color,
    data: [],
    silent: true,
    markArea: MarkArea({
      silent: false,
      itemStyle: {
        color,
        opacity: 0.2,
      },
      label: {
        show: false,
      },
      // I know this is gross but we don't have access to the types needed to satisfy the linter
      data: areaMarkData as any,
    }),
  });
}

function divideIntoIntervals(startTime: number, endTime: number, numSections: number) {
  const spaceBetweenIntervals = 10000000;
  const diff = endTime - startTime;
  const intervalLength = Math.round(diff / numSections);

  const intervals: number[][] = [];
  let currentTime = startTime;

  while (currentTime < endTime) {
    const currentInterval = [
      currentTime,
      currentTime + intervalLength - spaceBetweenIntervals,
    ];
    intervals.push(currentInterval);
    currentTime += intervalLength;
  }

  return intervals;
}
