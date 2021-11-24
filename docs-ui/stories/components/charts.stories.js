import BarChart from 'sentry/components/charts/barChart';
import LineChart from 'sentry/components/charts/lineChart';

export default {
  title: 'Components/Data Visualization/Charts/Playground',
  args: {
    height: 300,
    series: [
      {
        seriesName: 'sentry:user',
        data: [
          {value: 18, name: 'Aug 15th'},
          {value: 31, name: 'Aug 16th'},
          {value: 9, name: 'Aug 22nd'},
          {value: 100, name: 'Sep 5th'},
          {value: 12, name: 'Sep 6th'},
        ],
      },
      {
        seriesName: 'environment',
        data: [
          {value: 84, name: 'Aug 15th'},
          {value: 1, name: 'Aug 16th'},
          {value: 28, name: 'Aug 22nd'},
          {value: 1, name: 'Sep 5th'},
          {value: 1, name: 'Sep 6th'},
        ],
      },
      {
        seriesName: 'browser',
        data: [
          {value: 108, name: 'Aug 15th'},
          {value: 1, name: 'Aug 16th'},
          {value: 36, name: 'Aug 22nd'},
          {value: null, name: 'Sep 5th'},
          {value: 1, name: 'Sep 6th'},
        ],
      },
    ],
    grid: {
      top: 40,
      bottom: 20,
      left: '10%',
      right: '10%',
      containLabel: true,
    },
  },
};

export const _LineChart = ({height, series, legend, grid}) => (
  <div style={{backgroundColor: 'white', padding: 12}}>
    <LineChart
      series={series}
      tooltip={{
        filter: value => value !== null,
        truncate: 80,
      }}
      legend={legend}
      height={height}
      grid={grid}
    />
  </div>
);
_LineChart.args = {
  legend: {
    data: ['sentry:user', 'environment', 'browser'],
    type: 'scroll',
  },
};

export const _BarChart = ({height, series, legend, stacked, grid}) => (
  <div style={{backgroundColor: 'white', padding: 12}}>
    <BarChart
      stacked={stacked}
      renderer="canvas"
      series={series}
      tooltip={{
        filter: value => value !== null,
        truncate: 50,
      }}
      legend={legend}
      height={height}
      grid={grid}
    />
  </div>
);
_BarChart.args = {
  stacked: true,
  legend: {
    show: true,
    data: ['sentry:user', 'environment', 'browser'],
    padding: 0,
    type: 'scroll',
    orient: 'horizontal',
    align: 'auto',
    left: 'center',
    right: 'auto',
    top: 'auto',
    bottom: 'auto',
    width: 'auto',
    height: 'auto',
  },
};
_BarChart.parameters = {
  docs: {
    description: {
      story: 'Description: Note Scroll Legends does not work in storybook',
    },
  },
};
