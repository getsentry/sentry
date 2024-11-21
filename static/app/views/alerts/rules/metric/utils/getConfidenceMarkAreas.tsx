import MarkArea from 'sentry/components/charts/components/markArea';
import type {LineChartSeries} from 'sentry/components/charts/lineChart';
import type {Series} from 'sentry/types/echarts';
import theme from 'sentry/utils/theme';

export function getConfidenceMarkAreas(data: Series[]) {
  let previousConfidence: string | null = null;
  const markAreaBoundaries = data[0].data.reduce(
    (acc, curr) => {
      const {name, confidence} = curr;
      if (confidence && previousConfidence === null) {
        previousConfidence = confidence;
        return [{start: parseInt(name.toString(), 10), confidence}];
      }
      if (confidence && confidence !== previousConfidence) {
        previousConfidence = confidence;
        return [...acc, {start: parseInt(name.toString(), 10), confidence}];
      }
      return acc;
    },
    [] as {confidence: string; start: number}[]
  );

  const markAreaSeriesList: LineChartSeries[] = [];
  markAreaBoundaries.forEach(({start, confidence}, index) => {
    let nextStart = parseInt(data[0].data[data[0].data.length - 1].name.toString(), 10);
    if (index < markAreaBoundaries.length - 1) {
      nextStart = markAreaBoundaries[index + 1].start;
    }
    markAreaSeriesList.push({
      seriesName: '',
      type: 'line',
      markArea: MarkArea({
        silent: true,
        itemStyle: {
          color: confidence === 'HIGH' ? theme.green300 : theme.red300,
          opacity: 0.1,
        },
        data: [
          [
            {
              xAxis: start,
            },
            {
              xAxis: nextStart,
            },
          ],
        ],
      }),
      data: [],
    });
  });
  return markAreaSeriesList;
}
