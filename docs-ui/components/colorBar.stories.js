import React from 'react';
import styled from '@emotion/styled';
import {withInfo} from '@storybook/addon-info';

import theme from 'app/utils/theme';
import ColorBar from 'app/views/performance/vitalDetail/colorBar.tsx';

export default {
  title: 'Features/Vitals/ColorBar',
};

export const Default = withInfo(
  'Split a group of percentages or ratios into separate colors. Will stretch to cover the entire bar if missing percents'
)(() => (
  <Container>
    <ColorBar
      colorStops={[
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
      ]}
    />
  </Container>
));

Default.story = {
  name: 'default',
};

const Container = styled('div')`
  display: inline-block;
  width: 300px;
`;
