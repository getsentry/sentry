import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {TabPanels} from '@sentry/scraps/tabs';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TopResultsIndicator} from 'sentry/views/discover/table/topResultsIndicator';
import {DetailsWrapper} from 'sentry/views/explore/logs/styles';
import type {TableOrientation} from 'sentry/views/explore/metrics/hooks/useOrientationControl';
import {StyledPanel} from 'sentry/views/explore/tables/tracesTable/styles';

export const TabListWrapper = styled('div')<{orientation: TableOrientation}>`
  padding-top: 10px;
  width: 100%;

  ${p =>
    p.orientation === 'bottom' &&
    css`
      padding-top: 0;
      padding-bottom: 1px;
    `}
`;

export const StyledTopResultsIndicator = styled(TopResultsIndicator)``;

export const StyledSimpleTable = styled(SimpleTable)`
  position: relative;
  height: 100%;
  grid-template-rows: min-content 1fr;
`;

export const TransparentLoadingMask = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: ${p => p.theme.tokens.background.secondary};
  opacity: 0.6;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const WrappingText = styled('div')`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  gap: ${p => p.theme.space.sm};
  align-items: center;
`;

export const ExpandedRowContainer = styled('div')<{embedded?: boolean}>`
  grid-column: 1 / -1;
`;

export const StyledSimpleTableRowCell = styled(SimpleTable.RowCell)<{
  embedded?: boolean;
  noPadding?: boolean;
}>`
  padding: ${p => (p.noPadding ? 0 : p.embedded ? p.theme.space.xl : p.theme.space.lg)};
  padding-top: ${p =>
    p.noPadding ? 0 : p.embedded ? p.theme.space.sm : p.theme.space.xs};
  padding-bottom: ${p =>
    p.noPadding ? 0 : p.embedded ? p.theme.space.sm : p.theme.space.xs};

  font-size: ${p => p.theme.fontSize.sm};
`;

export const StyledSimpleTableHeaderCell = styled(SimpleTable.HeaderCell)<{
  embedded?: boolean;
  noPadding?: boolean;
}>`
  font-size: ${p => p.theme.fontSize.sm};
  padding: ${p => (p.noPadding ? 0 : p.embedded ? p.theme.space.xl : p.theme.space.lg)};
  padding-top: ${p =>
    p.noPadding ? 0 : p.embedded ? p.theme.space.sm : p.theme.space.xs};
  padding-bottom: ${p =>
    p.noPadding ? 0 : p.embedded ? p.theme.space.sm : p.theme.space.xs};
`;

export const StyledSimpleTableBody = styled('div')`
  position: relative;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  display: grid;
  grid-template-columns: subgrid;
  grid-auto-rows: min-content;
  grid-column: 1 / -1;
  scrollbar-gutter: stable;
`;

export const StyledSimpleTableHeader = styled(SimpleTable.Header)`
  height: 33px;
  z-index: unset;
  position: sticky;
  top: 0;
`;

export const StickyTableRow = styled(SimpleTable.Row)<{
  sticky?: boolean;
}>`
  ${p =>
    p.sticky &&
    `
    top: 0px;
    z-index: 1;
    background: ${p.theme.tokens.background.primary};
    position: sticky;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    margin-right: -15px;
    padding-right: calc(15px);
  `}
`;

export const DetailsContent = styled(StyledPanel)`
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.sm};
`;

export const MetricsDetailsWrapper = styled(DetailsWrapper)`
  border-top: 0;
  border-bottom: 0;
  margin-right: -15px;
  padding-right: calc(15px + ${p => p.theme.space.md});
`;

export const NumericSimpleTableHeaderCell = styled(StyledSimpleTableHeaderCell)`
  justify-content: flex-end;
`;

export const NumericSimpleTableRowCell = styled(StyledSimpleTableRowCell)`
  justify-content: flex-end;
`;

export const BodyContainer = styled('div')`
  padding: ${p => p.theme.space.md};
  padding-top: 0;
  height: 320px;
  container-type: inline-size;
`;

export const StyledTabPanels = styled(TabPanels)`
  overflow: auto;
`;

export const TableRowContainer = styled('div')`
  display: grid;
  grid-template-columns: subgrid;
  grid-auto-rows: min-content;
  grid-column: 1 / -1;

  :not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  }

  margin-right: -15px;
  padding-right: calc(15px);
`;
