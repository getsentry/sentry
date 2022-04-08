import styled from '@emotion/styled';

import ProgressBar from 'sentry/components/progressBar';
import space from 'sentry/styles/space';

export default {
  title: 'Components/Data Visualization/Charts/Progress Bar',
  component: ProgressBar,
};

export function _ProgressBar() {
  const progressBars = [];

  for (let i = 100; i > 0; i -= 10) {
    progressBars.push(<ProgressBar value={i} />);
  }

  return <Wrapper>{progressBars}</Wrapper>;
}

_ProgressBar.storyName = 'Progress Bar';

const Wrapper = styled('div')`
  width: 200px;
  display: grid;
  gap: ${space(3)};
`;
