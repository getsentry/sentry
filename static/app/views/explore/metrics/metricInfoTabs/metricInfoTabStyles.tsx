import styled from '@emotion/styled';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TopResultsIndicator} from 'sentry/views/discover/table/topResultsIndicator';
import {DetailsWrapper} from 'sentry/views/explore/logs/styles';
import {StyledPanel} from 'sentry/views/explore/tables/tracesTable/styles';

export const TabListWrapper = styled('div')`
  padding-top: ${p => p.theme.space.sm};
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
