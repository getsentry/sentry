import styled from '@emotion/styled';

import Panel from 'sentry/components/panels/panel';
import {space} from 'sentry/styles/space';

export const ModalChartContainer = styled('div')`
  height: 280px;
`;

export const ModalTableWrapper = styled(Panel)`
  margin-top: ${space(2)};
`;

const getColumns = (props: {columns?: number}) => {
  return props.columns || 3;
};

export const WidgetFooterTable = styled('div')<{columns?: number}>`
  display: grid;
  grid-template-columns: max-content 1fr repeat(${p => getColumns(p) - 2}, max-content);
  font-size: ${p => p.theme.fontSize.sm};
  width: 100%;

  & > * {
    padding: ${space(1)} ${space(0.5)};
    text-align: right;
  }

  & > *:nth-child(${p => getColumns(p)}n + 1) {
    position: relative;
    text-align: left;
  }

  & > *:nth-child(${p => getColumns(p)}n + 2) {
    ${p => p.theme.overflowEllipsis};
    padding-left: ${space(1.5)};
    min-width: 0px;
    text-align: left;
  }

  & > *:nth-child(${p => getColumns(p)}n) {
    padding-right: ${space(2)};
    text-align: right;
  }

  & > *:not(:nth-last-child(-n + ${p => getColumns(p)})) {
    border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  }
`;

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
  grid-template-rows: 190px 190px 300px 300px 300px 300px;
  grid-template-areas:
    'pos1'
    'pos2'
    'pos3'
    'pos4'
    'pos5'
    'pos6';

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-rows: 190px 300px 300px 300px;
    grid-template-areas:
      'pos1 pos2'
      'pos3 pos3'
      'pos4 pos4'
      'pos5 pos6';
  }

  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
    grid-template-rows: 190px 190px 300px;
    grid-template-areas:
      'pos1 pos3 pos3'
      'pos2 pos3 pos3'
      'pos4 pos5 pos6';
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
});
