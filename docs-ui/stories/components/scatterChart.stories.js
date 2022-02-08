import ScatterChart from 'sentry/components/charts/scatterChart';

export default {
  title: 'Components/Data Visualization/Charts/Scatter Chart',
  component: ScatterChart,
};

export const _ScatterChart = () => {
  return (
    <ScatterChart
      style={{height: 400}}
      series={[
        {
          seriesName: 'Chrome',
          data: [
            {
              value: 632,
              name: 'Jan 1',
            },
            {
              value: 326,
              name: 'Jan 1',
            },
            {
              value: 236,
              name: 'Jan 1',
            },
            {
              value: 107,
              name: 'Jan 2',
            },
            {
              value: 302,
              name: 'Jan 3',
            },
            {
              value: 3,
              name: 'Jan 4',
            },
          ],
        },
      ]}
    />
  );
};
