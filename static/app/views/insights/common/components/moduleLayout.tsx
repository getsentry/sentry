import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export const Layout = styled('div')`
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: ${space(2)};
`;

export const Third = styled('div')`
  grid-column: span 4;
`;

export const TwoThirds = styled('div')`
  grid-column: span 8;
`;

export const Half = styled('div')`
  grid-column: span 12;

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    grid-column: span 6;
  }
`;

export const Full = styled('div')`
  grid-column: span 12;
`;
