import type {CSSProperties} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex, type FlexProps} from '@sentry/scraps/layout';
import {
  Table,
  TABLE_HEAD_ROW_HEIGHT,
  TableResizer,
  TableStatusCell,
} from '@sentry/scraps/table';

import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';

export const GRID_BODY_ROW_HEIGHT = 42;
const GRID_STATUS_MESSAGE_HEIGHT = GRID_BODY_ROW_HEIGHT * 4;

export function Header(props: FlexProps) {
  return <Flex justify="between" align="center" marginBottom="md" {...props} />;
}

export const HeaderTitle = styled('h4')`
  margin: 0;
  font-size: ${p => p.theme.font.size.md};
  color: ${p => p.theme.tokens.content.secondary};
`;

export const HeaderButtonContainer = styled('div')`
  display: grid;
  gap: ${p => p.theme.space.md};
  grid-auto-flow: column;
  grid-auto-columns: auto;
  justify-items: end;

  /* Hovercard anchor element when features are disabled. */
  & > span {
    display: flex;
    flex-direction: row;
  }
`;

export const Body = styled(
  ({
    children,
    contentsBody,
    showVerticalScrollbar: _,
    ...props
  }: React.ComponentProps<typeof Panel> & {
    children?: React.ReactNode;
    contentsBody?: boolean;
    showVerticalScrollbar?: boolean;
  }) => (
    <Panel {...props}>
      <PanelBody display={contentsBody ? 'contents' : undefined}>{children}</PanelBody>
    </Panel>
  )
)`
  overflow-x: auto;
  overflow-y: ${({showVerticalScrollbar}) => (showVerticalScrollbar ? 'auto' : 'hidden')};
`;

/**
 * GridHead is the collection of elements that builds the header section of the
 * Grid. As the entirety of the add/remove/resize actions are performed on the
 * header, most of the elements behave different for each stage.
 */
/**
 * The shared shell owns column tracks only, so the row tracks, scroll containment
 * and sizing that these tables want are declared here.
 */
export const Grid = styled(Table, {
  shouldForwardProp: prop => prop !== 'fit' && prop !== 'height' && prop !== 'scrollable',
})<{
  fit?: 'max-content';
  height?: CSSProperties['height'];
  scrollable?: boolean;
}>`
  ${p =>
    p.scrollable &&
    css`
      overflow-x: auto;
      overflow-y: auto;
    `}

  /* Pin the header to a definite track height in both layouts; a content-based
     header track lets Safari mis-size the <thead> on back/forward navigation.
     Body track: 1fr absorbs slack when a height is given, else auto. */
  ${p =>
    p.height
      ? css`
          height: 100%;
          max-height: ${typeof p.height === 'number' ? p.height + 'px' : p.height};
          flex: 1;
          min-height: 0;

          &:has(> thead + tbody) {
            grid-template-rows: ${TABLE_HEAD_ROW_HEIGHT}px 1fr;
          }

          &:has(> thead + tbody + tbody) {
            grid-template-rows: ${TABLE_HEAD_ROW_HEIGHT}px fit-content(100%) 1fr;
          }
        `
      : css`
          &:has(> thead + tbody) {
            grid-template-rows: ${TABLE_HEAD_ROW_HEIGHT}px auto;
          }

          &:has(> thead + tbody + tbody) {
            grid-template-rows: ${TABLE_HEAD_ROW_HEIGHT}px fit-content(100%) auto;
          }
        `}

  min-width: ${p => p.fit};
`;

export const GridHead = styled(Table.Head)`
  background-color: ${p => p.theme.tokens.background.secondary};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  font-size: ${p => p.theme.font.size.sm};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  line-height: 1;
  text-transform: uppercase;
  user-select: none;
  color: ${p => p.theme.tokens.content.secondary};

  border-top-left-radius: ${p => p.theme.radius.md};
  border-top-right-radius: ${p => p.theme.radius.md};
`;

export const GridHeadCell = styled(Table.HeadCell, {
  shouldForwardProp: prop => prop !== 'isFirst',
})<{isFirst: boolean}>`
  height: ${TABLE_HEAD_ROW_HEIGHT}px;
  display: flex;
  align-items: center;
  min-width: 24px;
  padding: 0 ${p => p.theme.space.xl};

  border-right: 1px solid transparent;
  border-left: 1px solid transparent;

  a,
  div,
  span {
    line-height: 1.1;
    color: inherit;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
  }

  /* Truncating every div would clip the resize handle's hit area back to the line. */
  ${TableResizer}, ${TableResizer} div {
    overflow: visible;
  }

  &:last-child {
    border-right: none;
  }

  &:hover {
    border-left-color: ${p =>
      p.isFirst ? 'transparent' : p.theme.tokens.border.primary};
    border-right-color: ${p => p.theme.tokens.border.primary};
  }

  svg {
    min-width: 12px;
  }
`;

/**
 * Create spacing/padding similar to GridHeadCellWrapper but
 * without interactive aspects.
 */
export const GridHeadCellStatic = styled('th')`
  height: ${TABLE_HEAD_ROW_HEIGHT}px;
  display: flex;
  align-items: center;
  padding: 0 ${p => p.theme.space.xl};
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
  justify-content: center;

  &:first-child {
    padding: ${p => `${p.theme.space.md} 0 ${p.theme.space.md} ${p.theme.space['2xl']}`};
  }
`;

export const GridRow = styled(Table.Row, {
  shouldForwardProp: prop => prop !== 'isClickable',
})<{isClickable?: boolean}>`
  &:not(thead > &) {
    background-color: ${p => p.theme.tokens.background.primary};

    &:not(:last-child) {
      border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
    }

    &:last-child {
      border-bottom-left-radius: ${p => p.theme.radius.md};
      border-bottom-right-radius: ${p => p.theme.radius.md};
    }
  }

  ${p =>
    p.isClickable &&
    css`
      cursor: pointer;
    `}
`;

export const GridBodyCell = styled(Table.Cell)`
  /* Locking in the height makes calculation for resizer to be easier.
     min-height is used to allow a cell to expand and this is used to display
     feedback during empty/error state */
  min-height: ${GRID_BODY_ROW_HEIGHT}px;
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};

  display: flex;
  flex-direction: column;
  justify-content: center;

  font-size: ${p => p.theme.font.size.md};
`;

export const GridBodyCellStatic = styled(GridBodyCell)`
  /* Need to select the 2nd child to select the first cell
     as the first child is the interaction state layer */
  &:nth-child(2) {
    padding: ${p => `${p.theme.space.md} 0 ${p.theme.space.md} ${p.theme.space['2xl']}`};
  }
`;

const GridBodyCellStatus = styled(TableStatusCell)`
  min-height: ${GRID_STATUS_MESSAGE_HEIGHT}px;
  background-color: transparent;
  font-size: ${p => p.theme.font.size.md};
`;

export function GridStatus({children}: {children: React.ReactNode}) {
  return (
    <GridRow>
      <GridBodyCellStatus>{children}</GridBodyCellStatus>
    </GridRow>
  );
}
