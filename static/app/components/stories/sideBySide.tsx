import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

const SideBySide = styled('div')`
  display: flex;
  gap: ${space(2)};
  flex-wrap: wrap;
  align-items: flex-start;
`;

export const Grid = styled('div')<{columns?: number}>`
  display: grid;
  grid-template-columns: ${p =>
    p.columns ? `repeat(${p.columns}, 1fr)` : 'repeat(auto-fit, minmax(300px, 1fr))'};
  gap: ${space(2)};
`;

export default SideBySide;
