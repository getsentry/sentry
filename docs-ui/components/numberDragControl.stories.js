import React from 'react';
import styled from '@emotion/styled';
import {select, number} from '@storybook/addon-knobs';
import {action} from '@storybook/addon-actions';

import NumberDragControl from 'app/components/numberDragControl';

const onChange = action('onChange');

export default {
  title: 'Forms/Controls',
};

export const _NumberDragControl = () => (
  <Container>
    <NumberDragControl
      axis={select('Direction', {x: 'x', y: 'y'}, 'x')}
      step={number('Step')}
      shiftStep={number('Shift held step')}
      onChange={delta => onChange(delta)}
    />
  </Container>
);

_NumberDragControl.story = {
  name: 'NumberDragControl',
};

const Container = styled('div')`
  display: inline-block;
`;
