import React from 'react';
import styled from '@emotion/styled';
import {number, text, select} from '@storybook/addon-knobs';

import ProgressBar from 'app/components/progressBar';
import space from 'app/styles/space';
import {colors} from 'app/utils/theme';

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
        progressColor={select('progressColor', colors, colors.purple300)}
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
