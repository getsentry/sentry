import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex, type FlexProps} from '@sentry/scraps/layout';

import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {Table} from 'sentry/components/tables/table';
import {TableResizer, TableStatusCell} from 'sentry/components/tables/table/styles';

const GRID_HEAD_ROW_HEIGHT = 45;
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
  height: ${GRID_HEAD_ROW_HEIGHT}px;
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
  height: ${GRID_HEAD_ROW_HEIGHT}px;
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

/**
 * GridBody are the collection of elements that contains and display the data
 * of the Grid. They are rather simple.
 */
export const GridBody = styled(Table.Body)``;

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

export const GridBodyCellStatus = styled(TableStatusCell)`
  min-height: ${GRID_STATUS_MESSAGE_HEIGHT}px;
  background-color: transparent;
  font-size: ${p => p.theme.font.size.md};
`;

export const GridResizer = TableResizer;
