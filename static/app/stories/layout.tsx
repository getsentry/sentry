import styled from '@emotion/styled';

import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import {space} from 'sentry/styles/space';

export const SideBySide = styled('div')`
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
  grid-auto-rows: auto;
  align-items: start;
`;

export const SizingWindow = styled(NegativeSpaceContainer)<{display?: 'block' | 'flex'}>`
  border: 1px solid ${p => p.theme.yellow400};
  border-radius: ${p => p.theme.borderRadius};

  resize: both;
  padding: ${space(2)};
  display: ${p => (p.display === 'block' ? 'block' : 'flex')};
  overflow: ${p => (p.display === 'block' ? 'auto' : 'hidden')};
`;

export const Section = styled('section')`
  padding-top: ${space(2)};
`;

export const Title = styled('h2')`
  margin: 0;
  scroll-margin-top: ${space(2)};
`;
