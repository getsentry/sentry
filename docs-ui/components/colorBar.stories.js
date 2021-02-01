import React from 'react';
import styled from '@emotion/styled';

import theme from 'app/utils/theme';
import ColorBar from 'app/views/performance/vitalDetail/colorBar.tsx';

export default {
  title: 'Features/Vitals/ColorBar',
  component: ColorBar,
  args: {
    colorStops: [
      {
        color: theme.green300,
        percent: 0.6,
      },
      {
        color: theme.yellow300,
        percent: 0.3,
      },
      {
        color: theme.red300,
        percent: 0.1,
      },
    ],
  },
};

export const Default = ({...args}) => (
  <Container>
    <ColorBar {...args} />
  </Container>
);

Default.storyName = 'ColorBar';
Default.parameters = {
  docs: {
    description: {
      story:
        'Split a group of percentages or ratios into separate colors. Will stretch to cover the entire bar if missing percents',
    },
  },
};

const Container = styled('div')`
  display: inline-block;
  width: 300px;
`;
