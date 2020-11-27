import React from 'react';
import styled from '@emotion/styled';

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

const Wrapper = styled('div')`
  width: 200px;
  display: grid;
  grid-gap: ${space(3)};
`;
