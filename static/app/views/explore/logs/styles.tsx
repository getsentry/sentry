import type {Theme} from '@emotion/react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex, type FlexProps} from '@sentry/scraps/layout';

import {HighlightComponent} from 'sentry/components/highlight';
import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {Panel} from 'sentry/components/panels/panel';
import {GRID_BODY_ROW_HEIGHT} from 'sentry/components/tables/gridEditable/styles';
import {NumberContainer} from 'sentry/utils/discover/styles';
import {unreachable} from 'sentry/utils/unreachable';
import {
  Table,
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
      background-color: ${p =>
        p.theme.tokens.interactive.transparent.neutral.background.hover};
    }

    ${p =>
      p.isClickable &&
      `
      &:active {
        background-color: ${p.theme.tokens.interactive.transparent.neutral.background.active};
      }
    `}

    &:not(:last-child) {
      border-bottom: 0;
    }
  }

  .log-table-row-pseudo-row-chevron-replacement {
    width: 23px;
    height: 24px;
  }

  &[data-row-highlighted='true']:not(thead > &) {
    background-color: ${p => p.theme.tokens.background.transparent.warning.muted};
    color: ${p => p.theme.tokens.content.danger};

    &:hover {
      background-color: ${p => p.theme.tokens.background.transparent.warning.muted};
    }
  }

  &.beforeHoverTime + &.afterHoverTime:before {
    border-top: 1px solid ${p => p.theme.tokens.border.accent.moderate};
    content: '';
    left: 0;
    position: absolute;
    top: 0;
    width: 100%;
  }

  &.beforeHoverTime:last-child:before {
    border-bottom: 1px solid ${p => p.theme.tokens.border.accent.moderate};
    content: '';
    right: 0;
    position: absolute;
    bottom: 0;
    width: 100%;
  }

  &.beforeCurrentTime + &.afterCurrentTime:before {
    border-top: 1px solid ${p => p.theme.tokens.border.accent.vibrant};
    content: '';
    left: 0;
    position: absolute;
    top: 0;
    width: 100%;
  }

  &.beforeCurrentTime:last-child:before {
    border-bottom: 1px solid ${p => p.theme.tokens.border.accent.vibrant};
    content: '';
    right: 0;
    position: absolute;
    bottom: 0;
    width: 100%;
  }
`;

export const LogAttributeTreeWrapper = styled('div')`
  padding: ${p => p.theme.space.md} ${p => p.theme.space.md};
  border-bottom: 0px;
`;

export const LogTableBodyCell = styled(TableBodyCell)`
  min-height: ${LOGS_GRID_BODY_ROW_HEIGHT}px;

  padding: 2px ${p => p.theme.space.xl};

  font-size: ${p => p.theme.font.size.md};

  /* Need to select the 2nd child to select the first cell
     as the first child is the interaction state layer */
  &:nth-child(2) {
    padding: 2px 0 2px ${p => p.theme.space['2xl']};
  }

  &:last-child {
    padding: 2px ${p => p.theme.space.xl};
  }
`;

export const LogTable = styled(Table)`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin-bottom: 0;
  overflow-x: hidden;

  > div {
    flex: 1;
    min-height: 0;
  }
`;

export const LogTableBody = styled(TableBody)<{
  disableBodyPadding?: boolean;
  expanded?: boolean;
  showHeader?: boolean;
}>`
  ${p =>
    p.showHeader
      ? ''
      : p.disableBodyPadding
        ? ''
        : `
    padding-top: ${p.theme.space.md};
    padding-bottom: ${p.theme.space.md};
    `}
  overflow-x: hidden;
  overflow-y: auto;

  /* If a parent renderer bails out, the element might default to 0px: which causes Tanstack Virtual to stay at 0. */
  min-height: 1px;

  height: 100%;
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
export const LogDetailTableActionsCell = styled(TableBodyCell)`
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.xl};
  min-height: 0px;

  ${LogTableRow} & {
    padding: ${p => p.theme.space.xs} ${p => p.theme.space.xl};
  }
  &:last-child {
    padding: ${p => p.theme.space.xs} ${p => p.theme.space.xl};
  }
`;
export const LogDetailTableActionsButtonBar = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.md};
  & button {
    font-weight: ${p => p.theme.font.weight.sans.regular};
  }
`;

export const DetailsWrapper = styled('tr')`
  align-items: center;
  background-color: ${p => p.theme.colors.gray100};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.md};
  flex-direction: column;
  white-space: nowrap;
  grid-column: 1 / -1;
  display: grid;
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  z-index: ${1 /* place above the grid resizing lines */};
`;

export const DetailsContent = styled(StyledPanel)`
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
`;

export function LogFirstCellContent(props: FlexProps<'div'>) {
  return <Flex align="center" {...props} />;
}

export const LogBasicRendererContainer = styled('span')<{align?: 'left' | 'right'}>`
  ${NumberContainer} {
    text-align: ${p => p.align || 'left'};
  }
`;

export const DetailsBody = styled('div')`
  display: flex;
  border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  padding: ${p => p.theme.space.md} 0;
  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.sm};

  &:last-child {
    border-bottom: 0;
  }
`;

export const StyledChevronButton = styled(Button)`
  margin-right: ${p => p.theme.space.xs};
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
  margin-right: ${p => p.theme.space.xs};
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
  font-weight: ${p => p.theme.font.weight.sans.medium};
  font-family: ${p => p.theme.font.family.mono};
`;

export const LogDate = styled('span')<{align?: 'left' | 'center' | 'right'}>`
  color: ${p => p.theme.tokens.content.secondary};
  text-align: ${p => p.align || 'left'};
`;

export const LogsHighlight = styled(HighlightComponent)`
  font-weight: ${p => p.theme.font.weight.sans.medium};
  background-color: ${p => p.theme.colors.gray200};
  margin-right: 2px;
  margin-left: 2px;
`;

export const LogsFilteredHelperText = styled('span')`
  margin-left: 4px;
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.tokens.content.secondary};
  background-color: ${p => p.theme.colors.gray200};
`;

export const WrappingText = styled('div')<{wrapText?: boolean}>`
  white-space: ${p => (p.wrapText ? 'pre-wrap' : 'nowrap')};
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const AlignedCellContent = styled('div')<{
  align?: 'left' | 'center' | 'right';
}>`
  display: flex;
  align-items: center;
  flex-direction: row;
  justify-content: ${p => p.align || 'left'};
  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.sm};
`;

export const FirstTableHeadCell = styled(TableHeadCell)`
  padding-right: ${p => p.theme.space.md};
  padding-left: ${p => p.theme.space.xl};
`;

export const LogsTableBodyFirstCell = styled(LogTableBodyCell)`
  padding-right: 0;
  padding-left: ${p => p.theme.space.md};
`;

export function TableActionsContainer(props: FlexProps<'div'>) {
  return <Flex justify="end" align="center" gap="md" {...props} />;
}

export const LogsItemContainer = styled('div')`
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  margin-top: ${p => p.theme.space.md};
  margin-bottom: ${p => p.theme.space.md};
  position: relative;
  display: flex;
  flex-direction: column;
`;

export const LogsTableActionsContainer = styled(LogsItemContainer)`
  flex: 0 0 auto;
  overflow: visible;
  margin-bottom: 0;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
`;

export const LogsGraphContainer = styled(LogsItemContainer)`
  flex: 0 0 auto;
  overflow: visible;
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};
`;

export const AutoRefreshLabel = styled('label')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  margin-bottom: 0;
`;

export const AutoRefreshText = styled('span')`
  @media (max-width: ${p => p.theme.breakpoints.md}) {
    display: none;
  }
`;

export function getLogColors(level: SeverityLevel, theme: Theme) {
  switch (level) {
    case SeverityLevel.DEFAULT:
      return {
        background: theme.tokens.graphics.neutral.vibrant,
        backgroundLight: theme.tokens.background.transparent.neutral.muted,
        border: theme.tokens.border.neutral.moderate,
        borderHover: theme.tokens.border.neutral.vibrant,
        color: theme.tokens.content.secondary,
      };
    case SeverityLevel.TRACE:
      return {
        background: theme.tokens.graphics.accent.vibrant,
        backgroundLight: theme.tokens.background.transparent.accent.muted,
        border: theme.tokens.border.accent.moderate,
        borderHover: theme.tokens.border.accent.vibrant,
        color: theme.tokens.content.accent,
      };
    case SeverityLevel.WARN:
      return {
        background: theme.tokens.graphics.warning.vibrant,
        backgroundLight: theme.tokens.background.transparent.warning.muted,
        border: theme.tokens.border.warning.moderate,
        borderHover: theme.tokens.border.warning.vibrant,
        color: theme.tokens.content.warning,
      };
    case SeverityLevel.ERROR:
      return {
        background: theme.tokens.graphics.danger.vibrant,
        backgroundLight: theme.tokens.background.transparent.danger.muted,
        border: theme.tokens.border.danger.moderate,
        borderHover: theme.tokens.border.danger.vibrant,
        color: theme.tokens.content.danger,
      };
    case SeverityLevel.FATAL:
      return {
        background: theme.tokens.graphics.danger.vibrant,
        backgroundLight: theme.tokens.background.transparent.danger.muted,
        border: theme.tokens.border.danger.moderate,
        borderHover: theme.tokens.border.danger.vibrant,
        color: theme.tokens.content.danger,
      };
    case SeverityLevel.DEBUG:
      return {
        background: theme.tokens.graphics.neutral.vibrant,
        backgroundLight: theme.tokens.background.transparent.neutral.muted,
        border: theme.tokens.border.neutral.moderate,
        borderHover: theme.tokens.border.neutral.vibrant,
        color: theme.tokens.content.primary,
      };
    case SeverityLevel.INFO:
      return {
        background: theme.tokens.graphics.accent.vibrant,
        backgroundLight: theme.tokens.background.transparent.accent.muted,
        border: theme.tokens.border.transparent.accent.moderate,
        borderHover: theme.tokens.border.transparent.accent.vibrant,
        color: theme.tokens.content.accent,
      };
    case SeverityLevel.UNKNOWN:
      return {
        background: theme.tokens.graphics.neutral.vibrant,
        backgroundLight: theme.tokens.background.transparent.neutral.muted,
        border: theme.tokens.border.neutral.moderate,
        borderHover: theme.tokens.border.neutral.vibrant,
        color: theme.tokens.content.secondary,
      };
    default:
      unreachable(level);
      throw new Error(`Invalid log type, got ${level}`);
  }
}

export const LogsSidebarCollapseButton = styled(Button)<{sidebarOpen: boolean}>`
  display: none;

  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    display: inline-flex;
  }

  ${p =>
    p.sidebarOpen &&
    css`
      margin-left: -17px;
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;

      &::after {
        border-left-color: ${p.theme.tokens.border.primary};
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
      }
    `}
`;

export const FloatingBackToTopContainer = styled('div')<{
  inReplay?: boolean;
  tableWidth?: number;
}>`
  --floatingWidth: ${p => (p.tableWidth ? `${p.tableWidth}px` : '100%')};
  position: absolute;
  z-index: 1;
  opacity: ${p => (p.inReplay ? 1 : 0.9)};
  top: ${p => (p.inReplay ? p.theme.space.md : '65px')};
  left: calc(50% - var(--floatingWidth) / 2);
  width: var(--floatingWidth);
  display: flex;
  justify-content: center;

  pointer-events: none;

  & > * {
    pointer-events: auto;
  }
`;

export const FloatingBottomContainer = styled('div')<{
  tableWidth?: number;
}>`
  position: absolute;
  bottom: 0;
  width: ${p => (p.tableWidth ? `${p.tableWidth}px` : '100%')};
  display: flex;
  justify-content: center;
`;

export const HoveringRowLoadingRendererContainer = styled('div')<{
  headerHeight: number;
  height: number;
  position: 'top' | 'bottom';
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
    rgb(from ${p => p.theme.tokens.background.tertiary} r g b / 75%),
    rgb(from ${p => p.theme.tokens.background.secondary} r g b / 0%)
  );
  align-items: center;
  justify-content: center;
  height: ${p => p.height}px;
  ${p => (p.position === 'top' ? 'top: 0px;' : 'bottom: 0px;')}
`;

export const StyledPageFilterBar = styled(PageFilterBar)`
  width: auto;
`;

export const LogsFilterSection = styled('div')`
  display: grid;
  gap: ${p => p.theme.space.md};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    grid-template-columns: minmax(300px, auto) 1fr min-content;
  }
`;

export const TraceIconStyleWrapper = styled(Flex)`
  width: 18px;
  height: 18px;

  .TraceIcon {
    background-color: ${p => p.theme.colors.red400};
    position: absolute;
    transform: translate(-50%, -50%) scaleX(var(--inverse-span-scale)) translateZ(0);
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
    margin-right: -2px;
  }

  .TraceIcon svg {
    width: 12px;
    height: 12px;
    fill: #ffffff;
  }
`;
