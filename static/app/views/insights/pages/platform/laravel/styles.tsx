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
  font-size: ${p => p.theme.fontSizeSmall};

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
    border-bottom: 1px solid ${p => p.theme.border};
  }
`;

export const SeriesColorIndicator = styled('div')`
  position: absolute;
  left: -1px;
  width: 8px;
  height: 16px;
  border-radius: 0 3px 3px 0;
`;
