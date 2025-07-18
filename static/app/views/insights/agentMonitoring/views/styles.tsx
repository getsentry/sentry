import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export const SeriesColorIndicator = styled('div')`
  position: absolute;
  left: -1px;
  width: 8px;
  height: 16px;
  border-radius: 0 3px 3px 0;
`;

const StyledGrid = styled('div')`
  display: grid;
  gap: ${space(2)};
  padding-bottom: ${space(2)};

  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: 190px 190px 190px 280px 280px 280px 280px 280px 280px;
  grid-template-areas:
    'pos1'
    'pos2'
    'pos3'
    'pos4'
    'pos5'
    'pos6'
    'pos7'
    'pos8'
    'pos9';

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-rows: 190px 280px 280px 280px 280px;
    grid-template-areas:
      'pos1 pos2'
      'pos3 pos4'
      'pos5 pos6'
      'pos7 pos8'
      'pos9 pos9';
  }

  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
    grid-template-rows: 190px 280px 280px;
    grid-template-areas:
      'pos1 pos2 pos3'
      'pos4 pos5 pos6'
      'pos7 pos8 pos9';
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
  Position4: styled('div')`
    grid-area: pos4;
  `,
  Position5: styled('div')`
    grid-area: pos5;
  `,
  Position6: styled('div')`
    grid-area: pos6;
  `,
  Position7: styled('div')`
    grid-area: pos7;
  `,
  Position8: styled('div')`
    grid-area: pos8;
  `,
  Position9: styled('div')`
    grid-area: pos9;
  `,
});
