import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

const StyledGrid = styled('div')`
  display: grid;
  gap: ${space(2)};
  padding-bottom: ${space(2)};

  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: 260px 260px 260px;
  grid-template-areas:
    'pos1'
    'pos2'
    'pos3';

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-rows: 260px 260px;
    grid-template-areas:
      'pos1 pos2'
      'pos3 pos3';
  }

  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
    grid-template-rows: 260px;
    grid-template-areas: 'pos1 pos2 pos3';
  }
`;

export const WidgetGrid = Object.assign(StyledGrid, {
  Position1: styled('div')`
    grid-area: pos1;
  `,
  Position2: styled('div')`
    grid-area: pos2;
  `,
  Position3: styled('div')`
    grid-area: pos3;
  `,
});
