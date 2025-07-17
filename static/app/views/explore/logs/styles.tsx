import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {HighlightComponent} from 'sentry/components/highlight';
import {Body} from 'sentry/components/layouts/thirds';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import Panel from 'sentry/components/panels/panel';
import {GRID_BODY_ROW_HEIGHT} from 'sentry/components/tables/gridEditable/styles';
import {space} from 'sentry/styles/space';
import {chonkStyled} from 'sentry/utils/theme/theme.chonk';
import {withChonk} from 'sentry/utils/theme/withChonk';
import {unreachable} from 'sentry/utils/unreachable';
import {
  TableBody,
  TableBodyCell,
  TableHeadCell,
  TableRow,
} from 'sentry/views/explore/components/table';
import {SeverityLevel} from 'sentry/views/explore/logs/utils';

export const LOGS_GRID_BODY_ROW_HEIGHT = GRID_BODY_ROW_HEIGHT - 16;

interface LogTableRowProps {
  isClickable?: boolean;
}

const StyledPanel = styled(Panel)`
  margin-bottom: 0;
`;

export const LogTableRow = styled(TableRow)<LogTableRowProps>`
  &:not(thead > &) {
    cursor: ${p => (p.isClickable ? 'pointer' : 'default')};

    &:hover {
      background-color: ${p => p.theme.backgroundSecondary};
    }

    &:not(:last-child) {
      border-bottom: 0;
    }
  }
`;

export const LogAttributeTreeWrapper = styled('div')`
  padding: ${space(1)} ${space(1)};
  border-bottom: 1px solid ${p => p.theme.innerBorder};
`;

export const LogTableBodyCell = styled(TableBodyCell)`
  min-height: ${LOGS_GRID_BODY_ROW_HEIGHT}px;

  padding: 2px ${space(2)};

  font-size: ${p => p.theme.fontSize.md};

  /* Need to select the 2nd child to select the first cell
     as the first child is the interaction state layer */
  &:nth-child(2) {
    padding: 2px 0 2px ${space(3)};
  }

  &:last-child {
    padding: 2px ${space(2)};
  }
`;

export const LogTableBody = styled(TableBody)<{showHeader?: boolean}>`
  ${p =>
    p.showHeader
      ? ''
      : `
    padding-top: ${space(1)};
    padding-bottom: ${space(1)};
    `}
`;

export const LogDetailTableBodyCell = styled(TableBodyCell)`
  padding: 0;
  ${LogTableRow} & {
    padding: 0;
  }
  &:last-child {
    padding: 0;
  }
`;

export const DetailsWrapper = styled('tr')`
  align-items: center;
  background-color: ${p => p.theme.gray100};
  padding: ${space(1)} ${space(1)};
  flex-direction: column;
  white-space: nowrap;
  grid-column: 1 / -1;
  display: grid;
  border-top: 1px solid ${p => p.theme.border};
  border-bottom: 1px solid ${p => p.theme.border};
  z-index: ${2 /* place above the grid resizing lines */};
`;

export const DetailsContent = styled(StyledPanel)`
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: ${space(1)} ${space(2)};
`;

export const LogFirstCellContent = styled('div')`
  display: flex;
  align-items: center;
`;

export const DetailsBody = styled('div')`
  display: flex;
  border-bottom: 1px solid ${p => p.theme.innerBorder};
  padding: ${space(1)} 0;
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.codeFontSize};

  &:last-child {
    border-bottom: 0;
  }
`;

export const StyledChevronButton = styled(Button)`
  margin-right: ${space(0.5)};
`;

const DEFAULT_SIZE = '8px';

export const ColoredLogCircle = styled('span')<{
  logColors: ReturnType<typeof getLogColors>;
  size?: string;
}>`
  padding: 0;
  position: relative;
  width: ${p => p.size || DEFAULT_SIZE};
  height: ${p => p.size || DEFAULT_SIZE};
  margin-right: ${space(0.5)};
  text-indent: -9999em;
  display: inline-block;
  border-radius: 50%;
  flex-shrink: 0;
  background-color: ${p => p.logColors.background};
`;

export const ColoredLogText = styled('span')<{
  logColors: ReturnType<typeof getLogColors>;
}>`
  color: ${p => p.logColors.color};
  font-weight: ${p => p.theme.fontWeight.bold};
  font-family: ${p => p.theme.text.familyMono};
`;

export const LogDate = styled('span')<{align?: 'left' | 'center' | 'right'}>`
  color: ${p => p.theme.subText};
  text-align: ${p => p.align || 'left'};
`;

export const LogsHighlight = styled(HighlightComponent)`
  font-weight: ${p => p.theme.fontWeight.bold};
  background-color: ${p => p.theme.gray200};
  margin-right: 2px;
  margin-left: 2px;
`;

export const WrappingText = styled('div')<{wrap?: boolean}>`
  white-space: ${p => (p.wrap ? 'pre-wrap' : 'nowrap')};
  overflow: hidden;
  text-overflow: ellipsis;
  ${p => (p.wrap ? '' : '')}
`;

export const AlignedCellContent = styled('div')<{
  align?: 'left' | 'center' | 'right';
}>`
  display: flex;
  align-items: center;
  flex-direction: row;
  justify-content: ${p => p.align || 'left'};
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.codeFontSize};
`;

export const FirstTableHeadCell = styled(TableHeadCell)`
  padding-right: ${space(1)};
  padding-left: ${space(2)};
`;

export const LogsTableBodyFirstCell = styled(LogTableBodyCell)`
  padding-right: 0;
  padding-left: ${space(1)};
`;

export const FilterBarContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
  margin-bottom: ${space(1)};
`;

export const TableActionsContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
  justify-content: flex-end;
  align-items: center;
`;

export const LogsItemContainer = styled('div')`
  flex: 1 1 auto;
  margin-top: ${space(1)};
  margin-bottom: ${space(1)};
`;

export const LogsTableActionsContainer = styled(LogsItemContainer)`
  margin-bottom: 0;
  display: flex;
  justify-content: space-between;
`;

export const LogsGraphContainer = styled(LogsItemContainer)`
  height: 200px;
`;

export const StyledPageFilterBar = styled(PageFilterBar)`
  width: auto;
`;

export const AutoRefreshLabel = styled('label')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  margin-bottom: 0;
`;

export function getLogColors(level: SeverityLevel, theme: Theme) {
  switch (level) {
    case SeverityLevel.DEFAULT:
      return {
        background: theme.gray200,
        backgroundLight: theme.backgroundSecondary,
        border: theme.border,
        borderHover: theme.border,
        color: theme.gray200,
      };
    case SeverityLevel.TRACE:
      return {
        background: theme.blue300,
        backgroundLight: theme.blue100,
        border: theme.blue200,
        borderHover: theme.blue300,
        color: theme.blue400,
      };
    case SeverityLevel.WARN:
      return {
        background: theme.yellow300,
        backgroundLight: theme.yellow100,
        border: theme.yellow200,
        borderHover: theme.yellow300,
        color: theme.yellow400,
      };
    case SeverityLevel.ERROR:
      // All these colours are likely changing, so we'll hold off moving them into theme for now.
      return {
        background: '#FF7738', // Matches the legacy error level color
        backgroundLight: 'rgba(245, 113, 54, 0.11)',
        border: 'rgba(245, 113, 54, 0.55)',
        borderHover: '#FF7738',
        color: '#b34814',
      };
    case SeverityLevel.FATAL:
      return {
        background: theme.red300,
        backgroundLight: theme.red100,
        border: theme.red200,
        borderHover: theme.red300,
        color: theme.red400,
      };
    case SeverityLevel.DEBUG:
      return {
        background: theme.gray300,
        backgroundLight: theme.gray100,
        border: theme.gray200,
        borderHover: theme.gray300,
        color: theme.gray300,
      };
    case SeverityLevel.INFO:
      return {
        background: theme.blue300,
        backgroundLight: theme.blue100,
        border: theme.blue200,
        borderHover: theme.blue300,
        color: theme.blue400,
      };
    case SeverityLevel.UNKNOWN:
      return {
        background: theme.gray300,
        backgroundLight: theme.gray100,
        border: theme.gray200,
        borderHover: theme.gray300,
        color: theme.gray200,
      };
    default:
      unreachable(level);
      throw new Error(`Invalid log type, got ${level}`);
  }
}

export const TopSectionBody = styled(Body)`
  padding-bottom: 0;
  flex: 0 0 auto;

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    padding-bottom: ${space(2)};
  }
`;

export const BottomSectionBody = styled('div')`
  padding: ${space(2)} ${space(2)};
  padding-top: ${space(1)};
  background-color: ${p => p.theme.backgroundSecondary};
  border-top: 1px solid ${p => p.theme.border};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    padding: ${space(2)} ${space(4)};
    padding-top: ${space(1)};
  }
`;

export const ToolbarAndBodyContainer = styled('div')<{sidebarOpen: boolean}>`
  height: 100%;
  flex: 1 1 auto;

  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    display: grid;
    grid-template-columns: ${p => (p.sidebarOpen ? '325px minmax(100px, auto)' : 'auto')};
  }
`;

export const LogsSidebarCollapseButton = withChonk(
  styled(Button)<{sidebarOpen: boolean}>`
    width: 28px;
    border-left-color: ${p => p.theme.background};
    border-top-left-radius: 0px;
    border-bottom-left-radius: 0px;
    margin-bottom: ${space(1)};
    margin-left: -31px;
    display: none;

    @media (min-width: ${p => p.theme.breakpoints.md}) {
      display: block;
    }
  `,
  chonkStyled(Button)<{sidebarOpen: boolean}>`
    margin-bottom: ${space(1)};
    display: none;
    margin-left: -31px;

    @media (min-width: ${p => p.theme.breakpoints.md}) {
      display: inline-flex;
    }

    &::after {
      border-left-color: ${p => p.theme.background};
      border-top-left-radius: 0px;
      border-bottom-left-radius: 0px;
    }
  `
);

export const FloatingBackToTopContainer = styled('div')<{
  tableLeft?: number;
  tableWidth?: number;
}>`
  position: fixed;
  top: 20px;
  z-index: 1;
  opacity: 0.9;
  left: ${p => (p.tableLeft ? `${p.tableLeft}px` : '0')};
  width: ${p => (p.tableWidth ? `${p.tableWidth}px` : '100%')};
  display: flex;
  justify-content: center;

  pointer-events: none;

  & > * {
    pointer-events: auto;
  }
`;

export const HoveringRowLoadingRendererContainer = styled('div')<{
  headerHeight: number;
  position: 'top' | 'bottom';
  rowHeight: number;
}>`
  position: absolute;
  left: 0;
  right: 0;
  margin: 0 auto;
  z-index: 1;
  margin-top: ${p => (p.position === 'top' ? `${p.headerHeight + 1}px` : '0px')};
  display: flex;
  background: linear-gradient(
    to ${p => (p.position === 'top' ? 'bottom' : 'top')},
    rgb(from ${p => p.theme.backgroundTertiary} r g b / 75%),
    rgb(from ${p => p.theme.backgroundSecondary} r g b / 0%)
  );
  align-items: center;
  justify-content: center;
  height: ${p => p.rowHeight * 3}px;
  ${p => (p.position === 'top' ? 'top: 0px;' : 'bottom: 0px;')}
`;
