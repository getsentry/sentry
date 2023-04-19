import {Series} from 'sentry/types/echarts';

export function insertClickableAreasIntoSeries(series: Series[]) {
  const {data} = series[0];
  const startTime = data[0].name;
  const endTime = data[data.length - 1].name;

  // Hardcoded to 8 clickable sections for now
  divideIntoIntervals(startTime as number, endTime as number, 8);
}

function divideIntoIntervals(startTime: number, endTime: number, numSections: number) {
  const diff = endTime - startTime;
  const intervalLength = Math.round(diff / numSections);

  const intervals: number[][] = [];
  let currentTime = startTime;

  while (currentTime < endTime) {
    const currentInterval = [currentTime, currentTime + intervalLength];
    intervals.push(currentInterval);
    currentTime += intervalLength;
  }

  // intervals.forEach(([start, end]) =>
  //   console.log(`Start: ${new Date(start)} | End: ${new Date(end)}`)
  // );
}
