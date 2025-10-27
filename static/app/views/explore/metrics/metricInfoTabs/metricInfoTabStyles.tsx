import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import type {Alignments} from 'sentry/components/tables/gridEditable/sortLink';
import {GridBodyCell, GridHeadCell} from 'sentry/components/tables/gridEditable/styles';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TopResultsIndicator} from 'sentry/views/discover/table/topResultsIndicator';
import {Table} from 'sentry/views/explore/components/table';
import {DetailsWrapper, FirstTableHeadCell} from 'sentry/views/explore/logs/styles';
import {StyledPanel} from 'sentry/views/explore/tables/tracesTable/styles';

export const TableContainer = styled('div')`
  height: 100%;
  position: relative;
`;

export const StyledTableBodyCell = styled(GridBodyCell)<{
  align?: Alignments;
  isFirst?: boolean;
}>`
  font-size: ${p => p.theme.fontSize.sm};
  min-height: 12px;
  ${p => p.align && `justify-content: ${p.align};`}
  ${p => p.isFirst && `padding-left: 0;`}
`;

export const TableHeadCell = styled(GridHeadCell)<{
  align?: Alignments;
  isFirst?: boolean;
}>`
  ${p => p.align && `justify-content: ${p.align};`}
  font-size: ${p => p.theme.fontSize.sm};
  height: 26px;
  ${p => p.isFirst && `padding-left: 0;`}
`;

export const TabListWrapper = styled('div')`
  padding-top: ${p => p.theme.space.sm};
`;

export const TableHeadCellContent = styled(Flex)`
  cursor: pointer;
  user-select: none;
`;

export const StyledTopResultsIndicator = styled(TopResultsIndicator)``;

export const StyledFirstTableHeadCell = styled(FirstTableHeadCell)`
  height: 100%;
  border-right: none;
`;

export const StyledTable = styled(Table)`
  height: 100%;
  overflow-x: hidden;
`;

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
  background-color: ${p => p.theme.backgroundSecondary};
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

export const ExpandedRowContainer = styled('div')`
  grid-column: 1 / -1;
  border-bottom: 1px solid ${p => p.theme.innerBorder};
`;

export const StyledSimpleTableRowCell = styled(SimpleTable.RowCell)<{
  hasPadding?: boolean;
}>`
  padding: ${p => (p.hasPadding ? p.theme.space.xs : 0)};
  font-size: ${p => p.theme.fontSize.sm};
`;

export const StyledSimpleTableHeaderCell = styled(SimpleTable.HeaderCell)`
  font-size: ${p => p.theme.fontSize.sm};
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
`;

export const StyledSimpleTableHeader = styled(SimpleTable.Header)`
  height: 33px;
  z-index: unset;
`;

export const StickyTableRow = styled(SimpleTable.Row)<{
  isSticky?: boolean;
}>`
  ${p =>
    p.isSticky &&
    `
    top: 0px;
    z-index: 1;
    background: ${p.theme.background};
    position: sticky;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
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
`;
