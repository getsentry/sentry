import styled from '@emotion/styled';
import {action} from '@storybook/addon-actions';

import NumberDragControl from 'sentry/components/numberDragControl';

export default {
  title: 'Components/Forms/Controls/Number Drag Control',
  component: NumberDragControl,
  args: {
    step: 1,
    shiftStep: 1,
    axis: 'x',
  },
  argTypes: {
    axis: {
      control: {
        type: 'select',
        options: ['x', 'y'],
      },
    },
  },
};

export const _NumberDragControl = ({axis, step, shiftStep}) => (
  <Container>
    <NumberDragControl
      axis={axis}
      step={step}
      shiftStep={shiftStep}
      onChange={action('onChange')}
    />
  </Container>
);

_NumberDragControl.storyName = 'Number Drag Control';

const Container = styled('div')`
  display: inline-block;
`;
