import PieChart from 'app/components/charts/pieChart';

export default {
  title: 'Components/Data Visualization/Charts/Pie Chart',
  component: PieChart,
};

export const _PieChart = () => (
  <PieChart
    startDate={new Date()}
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
