import {withInfo} from '@storybook/addon-info';

import BreakdownBars from 'app/components/charts/breakdownBars';

export default {
  title: 'Charts/BreakdownBars',
};

export const Default = withInfo('Horizontal bar chart with labels')(() => {
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
});

Default.story = {
  name: 'BreakdownBars',
};
