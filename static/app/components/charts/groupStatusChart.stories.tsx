import styled from '@emotion/styled';

import GroupStatusChart from 'sentry/components/charts/groupStatusChart';
import storyBook from 'sentry/stories/storyBook';
import type {TimeseriesValue} from 'sentry/types/core';

const stats: readonly TimeseriesValue[] = [
  [1715554800, 126],
  [1715558400, 112],
  [1715562000, 126],
  [1715565600, 113],
  [1715569200, 118],
  [1715572800, 87],
  [1715576400, 88],
  [1715580000, 59],
  [1715583600, 54],
  [1715587200, 55],
  [1715590800, 52],
  [1715594400, 48],
  [1715598000, 62],
  [1715601600, 86],
  [1715605200, 100],
  [1715608800, 121],
  [1715612400, 124],
  [1715616000, 129],
  [1715619600, 149],
  [1715623200, 141],
  [1715626800, 132],
  [1715630400, 133],
  [1715634000, 127],
  [1715637600, 82],
];

export default storyBook(GroupStatusChart, story => {
  story('Default', () => {
    return (
      <GraphContainer>
        <GroupStatusChart showMarkLine stats={stats} groupStatus="Escalating" />
      </GraphContainer>
    );
  });
});

const GraphContainer = styled('div')`
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
`;
