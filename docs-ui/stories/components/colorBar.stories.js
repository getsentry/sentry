import styled from '@emotion/styled';

import Tooltip from 'sentry/components/tooltip';
import theme from 'sentry/utils/theme';
import ColorBar from 'sentry/views/performance/vitalDetail/colorBar.tsx';

export default {
  title: 'Components/Data Visualization/Charts/Color Bar',
  component: ColorBar,
};

export const Default = ({...args}) => (
  <Container>
    <ColorBar {...args} />
  </Container>
);
Default.args = {
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
};
Default.storyName = 'Color Bar';
Default.parameters = {
  docs: {
    description: {
      story:
        'Split a group of percentages or ratios into separate colors. Will stretch to cover the entire bar if missing percents',
    },
  },
};

export const WithTooltips = ({...args}) => (
  <Container>
    <ColorBar {...args} />
  </Container>
);
WithTooltips.args = {
  colorStops: [
    {
      color: theme.green300,
      percent: 0.6,
      renderBarStatus: (barStatus, key) => (
        <Tooltip title="A - 60%" skipWrapper key={key}>
          {barStatus}
        </Tooltip>
      ),
    },
    {
      color: theme.yellow300,
      percent: 0.4,
      renderBarStatus: (barStatus, key) => (
        <Tooltip title="B - 40%" skipWrapper key={key}>
          {barStatus}
        </Tooltip>
      ),
    },
  ],
};
WithTooltips.parameters = {
  docs: {
    description: {
      story:
        'Specify a custom render function for the bars. For example you can add Tooltips via composition.',
    },
  },
};

const Container = styled('div')`
  display: inline-block;
  width: 300px;
`;
