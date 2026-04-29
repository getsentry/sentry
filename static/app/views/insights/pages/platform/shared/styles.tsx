import styled from '@emotion/styled';

import {Panel} from 'sentry/components/panels/panel';

export const ModalChartContainer = styled('div')`
  height: 280px;
`;

export const ModalTableWrapper = styled(Panel)`
  margin-top: ${p => p.theme.space.xl};
`;

const getColumns = (props: {columns?: number}) => {
  return props.columns || 3;
};

export const WidgetFooterTable = styled('div')<{columns?: number}>`
  display: grid;
  grid-template-columns: max-content 1fr repeat(${p => getColumns(p) - 2}, max-content);
  font-size: ${p => p.theme.font.size.sm};
  width: 100%;

  & > * {
    padding: ${p => p.theme.space.md} ${p => p.theme.space.xs};
    text-align: right;
  }

  & > *:nth-child(${p => getColumns(p)}n + 1) {
    position: relative;
    text-align: left;
  }

  & > *:nth-child(${p => getColumns(p)}n + 2) {
    display: block;
    width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-left: ${p => p.theme.space.lg};
    min-width: 0px;
    text-align: left;
  }

  & > *:nth-child(${p => getColumns(p)}n) {
    padding-right: ${p => p.theme.space.xl};
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
