import React from 'react';
import styled from '@emotion/styled';
import {number, text} from '@storybook/addon-knobs';

import ProgressBar from 'app/components/progressBar';
import space from 'app/styles/space';

export default {
  title: 'DataVisualization/Charts/ProgressBar',
};

export function Basic() {
  const progressBars = [];

  for (let i = 100; i > 0; i -= 10) {
    progressBars.push(<ProgressBar value={i} />);
  }

  return <Wrapper>{progressBars}</Wrapper>;
}

Basic.story = {name: 'basic'};

export function WithTooltip() {
  return (
    <Wrapper>
      <ProgressBar
        value={number('value', 50)}
        tooltipText={text('tooltipText', 'lorem ipsum')}
      />
    </Wrapper>
  );
}

WithTooltip.story = {name: 'with tooltip'};

const Wrapper = styled('div')`
  width: 200px;
  display: grid;
  grid-gap: ${space(3)};
`;
