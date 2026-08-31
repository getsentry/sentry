import type {CSSProperties, ReactNode, RefObject} from 'react';
import {useMemo} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {
  COL_WIDTH_MINIMUM,
  Table,
  type TableColumnConfig,
  TABLE_HEAD_ROW_HEIGHT,
  TableResizer,
  TableStatusCell,
} from '@sentry/scraps/table';

import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {HeaderCellContent} from 'sentry/components/tables/sortableHeaderCell';
import {defined} from 'sentry/utils/defined';

export const DATA_TABLE_ROW_HEIGHT = 42;

const STATUS_MESSAGE_HEIGHT = DATA_TABLE_ROW_HEIGHT * 4;

const Frame = styled(
  ({
    children,
    contentsBody,
    showVerticalScrollbar: _,
    ...props
  }: React.ComponentProps<typeof Panel> & {
    children?: ReactNode;
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
 * The shared shell owns column tracks only, so the row tracks, scroll containment
 * and sizing that these tables want are declared here.
 */
const Grid = styled(Table, {
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

const Head = styled(Table.Head)`
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

const HeadCell = styled(Table.HeadCell, {
  shouldForwardProp: prop => prop !== 'align' && prop !== 'isFirst',
})<{align?: 'left' | 'right'; isFirst?: boolean}>`
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

  ${HeaderCellContent} > svg {
    align-self: flex-start;
  }

  ${p =>
    p.align &&
    css`
      justify-content: ${p.align};

      ${HeaderCellContent} {
        justify-content: ${p.align};
      }
    `}
`;

const Row = styled(Table.Row, {
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

const Cell = styled(Table.Cell)`
  /* Locking in the height makes calculation for resizer to be easier.
     min-height is used to allow a cell to expand and this is used to display
     feedback during empty/error state */
  min-height: ${DATA_TABLE_ROW_HEIGHT}px;
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};

  display: flex;
  flex-direction: column;
  justify-content: center;

  font-size: ${p => p.theme.font.size.md};
`;

const StatusCell = styled(TableStatusCell)`
  min-height: ${STATUS_MESSAGE_HEIGHT}px;
  background-color: transparent;
  font-size: ${p => p.theme.font.size.md};
`;

function Status({children}: {children: ReactNode}) {
  return (
    <Row>
      <StatusCell>{children}</StatusCell>
    </Row>
  );
}

export interface DataTableColumnOptions {
  fields?: readonly string[];
  minimumColumnWidth?: number;
  prefixColumnWidth?: 'min-content' | number;
  staticColumnWidths?: Record<string, number | string>;
}

function useDataTableProps({
  fields,
  minimumColumnWidth = COL_WIDTH_MINIMUM,
  prefixColumnWidth,
  staticColumnWidths,
}: DataTableColumnOptions) {
  const columns = useMemo<TableColumnConfig[]>(
    () => (fields ?? []).map(field => ({key: field, width: staticColumnWidths?.[field]})),
    [fields, staticColumnWidths]
  );

  const prependColumnWidths = useMemo(
    () =>
      defined(prefixColumnWidth)
        ? [
            typeof prefixColumnWidth === 'number'
              ? `${prefixColumnWidth}px`
              : prefixColumnWidth,
          ]
        : [],
    [prefixColumnWidth]
  );

  return {
    columns,
    flexibleLastColumn: false,
    minimumColumnWidth,
    prependColumnWidths,
  };
}

interface DataTableProps
  extends Omit<React.ComponentProps<typeof Frame>, 'height'>, DataTableColumnOptions {
  height?: CSSProperties['height'];
  ref?: RefObject<HTMLTableElement | null>;
  scrollable?: boolean;
}

export function DataTable({
  children,
  fields,
  height,
  minimumColumnWidth,
  prefixColumnWidth,
  ref,
  scrollable,
  staticColumnWidths,
  ...props
}: DataTableProps) {
  const tableProps = useDataTableProps({
    fields,
    minimumColumnWidth,
    prefixColumnWidth,
    staticColumnWidths,
  });

  return (
    <Frame {...props}>
      <Grid {...tableProps} height={height} ref={ref} scrollable={scrollable}>
        {children}
      </Grid>
    </Frame>
  );
}

DataTable.Body = Table.Body;
DataTable.Cell = Cell;
DataTable.Frame = Frame;
DataTable.Grid = Grid;
DataTable.Head = Head;
DataTable.HeadCell = HeadCell;
DataTable.Row = Row;
DataTable.Status = Status;
