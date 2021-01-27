import React from 'react';
import {withInfo} from '@storybook/addon-info';
import {text} from '@storybook/addon-knobs';

import SimpleTableChart from 'app/components/charts/simpleTableChart';

export default {
  title: 'DataVisualization/Charts/SimpleTableChart',
};

export const _SimpleTableChart = withInfo(
  'A borderless table that can be used in charts/dashboards'
)(() => {
  const organization = {slug: 'org-slug'};
  const fields = ['title', 'count()'];
  const metadata = {count: 'string', title: 'string'};
  const data = [
    {title: 'An error', count: 100},
    {title: 'An longer title that goes on a bit', count: 1000},
  ];
  const title = text('title', '');
  return (
    <div className="section">
      <h2>Loading State</h2>
      <SimpleTableChart
        organization={organization}
        fields={fields}
        title={title}
        metadata={undefined}
        data={[]}
        loading
      />
      <h2>Filled State</h2>
      <SimpleTableChart
        organization={organization}
        fields={fields}
        title={title}
        metadata={metadata}
        data={data}
      />
    </div>
  );
});
