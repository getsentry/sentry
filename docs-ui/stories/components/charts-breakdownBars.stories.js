import BreakdownBars from 'sentry/components/charts/breakdownBars';

export default {
  title: 'Components/Data Visualization/Charts/Breakdown Bars',
  component: BreakdownBars,
  parameters: {
    controls: {hideNoControlsWarning: true},
  },
};

export const Default = () => {
  const data = [
    {label: 'unknown', value: 910},
    {label: 'not_found', value: 40},
    {label: 'data_loss', value: 30},
    {label: 'cancelled', value: 20},
  ];
  return (
    <div className="section">
      <BreakdownBars data={data} />
    </div>
  );
};

Default.storyName = 'Breakdown Bars';
Default.parameters = {
  docs: {
    description: {
      story: 'Horizontal bar chart with labels',
    },
  },
};
