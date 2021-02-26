import React from 'react';

import BreakdownBars from 'app/components/charts/breakdownBars';

export default {
  title: 'DataVisualization/Charts/BreakdownBars',
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

Default.storyName = 'BreakdownBars';
Default.parameters = {
  docs: {
    description: {
      story: 'Horizontal bar chart with labels',
    },
  },
};
