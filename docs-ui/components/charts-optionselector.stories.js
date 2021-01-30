import React from 'react';
import styled from '@emotion/styled';

import OptionSelector from 'app/components/charts/optionSelector';
import space from 'app/styles/space';

const options = [
  {value: 'all', label: 'All things'},
  {value: 'none', label: 'No things'},
  {value: 'top5', label: 'Top 5 things that is a much longer title'},
  {value: 'nope', disabled: true, label: 'Disabled option'},
  {value: 'more', label: 'Additional option'},
];

export default {
  title: 'DataVisualization/Charts/OptionSelector',
  component: OptionSelector,
  args: {
    selected: 'none',
    title: 'Display',
    options,
    menuWidth: '200px',
  },
  argTypes: {
    onChange: {action: 'changed'},
  },
};

export const Default = ({...args}) => (
  <Container style={{padding: '0 50px 200px'}}>
    <OptionSelector {...args} />
  </Container>
);

Default.storyName = 'OptionSelector';
Default.parameters = {
  docs: {
    description: {
      story: 'Selector control for chart controls',
    },
  },
};

const Container = styled('div')`
  padding: ${space(2)} ${space(3)};
`;
