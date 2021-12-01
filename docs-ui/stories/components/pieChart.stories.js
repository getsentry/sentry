import PieChart from 'sentry/components/charts/pieChart';

export default {
  title: 'Components/Data Visualization/Charts/Pie Chart',
  component: PieChart,
};

export const _PieChart = () => (
  <PieChart
    selectOnRender
    series={[
      {
        seriesName: 'Browsers',
        data: [
          {
            name: 'Chrome',
            value: 3500,
          },
          {
            name: 'Firefox',
            value: 650,
          },
          {
            name: 'Safari',
            value: 250,
          },
        ],
      },
    ]}
  />
);
