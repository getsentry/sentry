import type {
  ComponentProps,
  CSSProperties,
  HTMLAttributes,
  ReactNode,
  RefObject,
  TdHTMLAttributes,
} from 'react';
import {createContext, Fragment, useContext} from 'react';
import {css} from '@emotion/react';
import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import type {CSS} from '@sentry/scraps/cssTypes';
import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';
import {Flex, type FlexProps} from '@sentry/scraps/layout';
import {
  fullWidthCellStyle,
  Table,
  type TableColumnConfig,
  TABLE_HEAD_ROW_HEIGHT,
  TableResizer,
} from '@sentry/scraps/table';

import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {
  type ColumnAlign,
  HeaderCellContent,
  type SortDirection,
} from 'sentry/components/tables/sortableHeaderCell';
import {TableEmpty, TableError, TableLoading} from 'sentry/components/tables/statusRows';
import {defined} from 'sentry/utils/defined';
import {PanelProvider} from 'sentry/utils/panelProvider';

export const RESULTS_TABLE_ROW_HEIGHT = 42;

type SimpleTableVariant = 'default' | 'results';

const SimpleTableVariantContext = createContext<SimpleTableVariant | undefined>(
  undefined
);

export function useSimpleTableVariant() {
  return useContext(SimpleTableVariantContext);
}

function VariantProvider({
  children,
  variant,
}: {
  children: ReactNode;
  variant: SimpleTableVariant;
}) {
  return (
    <SimpleTableVariantContext value={variant}>{children}</SimpleTableVariantContext>
  );
}

interface BaseTableProps extends Omit<HTMLAttributes<HTMLTableElement>, 'children'> {
  children?: ReactNode;
  columns?: TableColumnConfig[];
  /** Defaults to `true`, or to `false` in the `results` variant. */
  flexibleLastColumn?: boolean;
  minimumColumnWidth?: number;
  onColumnResize?: (index: number, width: number) => void;
  prependColumnWidths?: string[];
  ref?: RefObject<HTMLTableElement | null>;
}

type TableSectionsProps =
  | {
      /**
       * Render `children` as the table's sections, such as `SimpleTable.Head` and
       * `SimpleTable.Body`, instead of as the rows of a single body.
       */
      customSections: true;
      header?: never;
    }
  | {
      customSections?: false;
      /** The header row, rendered into the table's `<thead>`. */
      header?: ReactNode;
    };

type DefaultTableProps = BaseTableProps &
  TableSectionsProps & {
    contentsBody?: never;
    fit?: never;
    height?: never;
    hideBorder?: never;
    scrollable?: never;
    showVerticalScrollbar?: never;
    variant?: 'default';
  };

type ResultsTableProps = BaseTableProps &
  TableSectionsProps & {
    variant: 'results';
    /** Applies to the panel around the table, so that it can size the whole frame. */
    className?: string;
    contentsBody?: boolean;
    fit?: 'max-content';
    height?: CSS['height'];
    hideBorder?: boolean;
    scrollable?: boolean;
    showVerticalScrollbar?: boolean;
    /** Applies to the panel around the table, so that it can size the whole frame. */
    style?: CSSProperties;
  };

type TableProps = DefaultTableProps | ResultsTableProps;

interface RowProps extends HTMLAttributes<HTMLTableRowElement> {
  isClickable?: boolean;
  ref?: RefObject<HTMLTableRowElement | null>;
  variant?: 'default' | 'faded';
}

type HeaderCellVariant = 'default' | 'first' | 'remaining' | 'full-width';

export function SimpleTable(props: TableProps) {
  return props.variant === 'results' ? (
    <ResultsTable {...props} />
  ) : (
    <DefaultTable {...props} />
  );
}

function TableSections({
  children,
  customSections,
  header,
}: {
  children?: ReactNode;
  customSections?: boolean;
  header?: ReactNode;
}) {
  if (customSections) {
    return children;
  }

  return (
    <Fragment>
      {header && <Head>{header}</Head>}
      <Table.Body>{children}</Table.Body>
    </Fragment>
  );
}

function DefaultTable({
  children,
  columns,
  customSections,
  header,
  variant: _variant,
  ...props
}: DefaultTableProps) {
  // This shell has no resize affordance, so its columns do not opt into one.
  const unresizableColumns = columns?.map(column => ({resizable: false, ...column}));

  return (
    <SimpleTableVariantContext value="default">
      <StyledTable columns={unresizableColumns} {...props}>
        <PanelProvider>
          <TableSections customSections={customSections} header={header}>
            {children}
          </TableSections>
        </PanelProvider>
      </StyledTable>
    </SimpleTableVariantContext>
  );
}

function ResultsTable({
  children,
  className,
  contentsBody,
  customSections,
  flexibleLastColumn = false,
  header,
  hideBorder,
  showVerticalScrollbar,
  style,
  variant: _variant,
  ...props
}: ResultsTableProps) {
  return (
    <SimpleTableVariantContext value="results">
      <ResultsFrame
        className={className}
        contentsBody={contentsBody}
        hideBorder={hideBorder}
        showVerticalScrollbar={showVerticalScrollbar}
        style={style}
      >
        <ResultsGrid {...props} flexibleLastColumn={flexibleLastColumn}>
          <TableSections customSections={customSections} header={header}>
            {children}
          </TableSections>
        </ResultsGrid>
      </ResultsFrame>
    </SimpleTableVariantContext>
  );
}

function Head(props: ComponentProps<typeof Table.Head>) {
  const variant = useSimpleTableVariant();

  return variant === 'results' ? <ResultsHead {...props} /> : <Table.Head {...props} />;
}

function HeaderRow({
  children,
  sticky,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & {
  /**
   * Only applies in the `default` variant. A `results` table sticks its header by
   * passing `sticky` to `SimpleTable.Head`, which carries the header background.
   */
  sticky?: boolean;
}) {
  const variant = useSimpleTableVariant();

  if (variant === 'results') {
    return <Table.Row {...props}>{children}</Table.Row>;
  }

  return (
    <StyledHeaderRow sticky={sticky} {...props}>
      {children}
    </StyledHeaderRow>
  );
}

function HeaderCell({
  align,
  children,
  sort,
  handleSortClick,
  isFirst,
  to,
  variant = 'default',
  divider = defined(children) ? true : false,
  ...props
}: HTMLAttributes<HTMLTableCellElement> & {
  align?: ColumnAlign;
  children?: React.ReactNode;
  columnIndex?: number;
  /** Only applies in the `default` variant. */
  divider?: boolean;
  handleSortClick?: (event: React.MouseEvent) => void;
  /**
   * Whether the cell starts the row, which hides its leading hover border in the
   * `results` variant. Prepended cells can precede it, so `:first-child` can't.
   */
  isFirst?: boolean;
  replace?: boolean;
  sort?: SortDirection;
  to?: LocationDescriptor;
  variant?: HeaderCellVariant;
}) {
  const tableVariant = useSimpleTableVariant();

  if (tableVariant === 'results') {
    return (
      <ResultsHeaderCell
        {...props}
        align={align}
        isFirst={isFirst}
        onSort={handleSortClick}
        placement={variant}
        scope="col"
        sort={sort}
        to={to}
      >
        {children}
      </ResultsHeaderCell>
    );
  }

  return (
    <ColumnHeaderCell
      {...props}
      align={align}
      onSort={handleSortClick}
      overlays={
        <Fragment>
          {divider && <HeaderDivider />}
          {(handleSortClick || to) && <InteractionStateLayer />}
        </Fragment>
      }
      placement={variant}
      to={to}
      scope="col"
      sort={sort}
    >
      {children}
    </ColumnHeaderCell>
  );
}

function Row({children, isClickable, variant = 'default', ref, ...props}: RowProps) {
  const tableVariant = useSimpleTableVariant();

  if (tableVariant === 'results') {
    return (
      <ResultsRow isClickable={isClickable} variant={variant} ref={ref} {...props}>
        {children}
      </ResultsRow>
    );
  }

  return (
    <StyledRow divider isClickable={isClickable} variant={variant} ref={ref} {...props}>
      {children}
    </StyledRow>
  );
}

/**
 * A `results` cell lays its content out as a column, so its `justify` aligns
 * vertically and its `align` aligns horizontally.
 */
function RowCell({
  children,
  ...props
}: FlexProps<'td'> & Pick<TdHTMLAttributes<HTMLTableCellElement>, 'colSpan'>) {
  const variant = useSimpleTableVariant();

  if (variant === 'results') {
    return (
      <ResultsRowCell
        as="td"
        role="cell"
        direction="column"
        justify="center"
        minHeight={`${RESULTS_TABLE_ROW_HEIGHT}px`}
        minWidth="0"
        padding="md xl"
        {...props}
      >
        {children}
      </ResultsRowCell>
    );
  }

  return (
    <Flex as="td" role="cell" align="center" overflow="hidden" padding="lg xl" {...props}>
      {children}
    </Flex>
  );
}

const StyledTable = styled(Table)`
  background: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  position: relative;
  margin: 0;
  width: 100%;
  overflow: hidden;
`;

const ResultsFrame = styled(
  ({
    children,
    contentsBody,
    showVerticalScrollbar: _,
    ...props
  }: ComponentProps<typeof Panel> & {
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
const ResultsGrid = styled(Table, {
  shouldForwardProp: prop => prop !== 'fit' && prop !== 'height' && prop !== 'scrollable',
})<{
  fit?: 'max-content';
  height?: CSS['height'];
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
          max-height: ${p.height};
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

const ResultsHead = styled(Table.Head)`
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

const StyledHeaderRow = styled(Table.Row, {
  shouldForwardProp: prop => prop !== 'sticky',
})<{sticky?: boolean}>`
  background: ${p => p.theme.tokens.background.secondary};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: calc(${p => p.theme.radius.md} + 1px)
    calc(${p => p.theme.radius.md} + 1px) 0 0;
  text-transform: none;
  justify-content: left;
  padding: 0;
  min-height: 40px;
  align-items: center;

  ${p =>
    p.sticky &&
    css`
      position: sticky;
      top: 0;
      z-index: ${p.theme.zIndex.initial};
    `}
`;

const fadedRowStyle = (p: {variant?: 'default' | 'faded'}) =>
  p.variant === 'faded' &&
  css`
    [role='cell'] {
      opacity: 0.8;
    }
  `;

const clickableRowStyle = (p: {isClickable?: boolean}) =>
  p.isClickable &&
  css`
    cursor: pointer;
  `;

const StyledRow = styled(Table.Row, {
  shouldForwardProp: prop => prop !== 'isClickable' && prop !== 'variant',
})<{isClickable?: boolean; variant?: 'default' | 'faded'}>`
  align-items: center;

  ${fadedRowStyle}
  ${clickableRowStyle}
`;

const ResultsRow = styled(Table.Row, {
  shouldForwardProp: prop => prop !== 'isClickable' && prop !== 'variant',
})<{isClickable?: boolean; variant?: 'default' | 'faded'}>`
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

  ${fadedRowStyle}
  ${clickableRowStyle}
`;

const ResultsRowCell = styled(Flex)`
  font-size: ${p => p.theme.font.size.md};
`;

const HeaderDivider = styled('div')`
  position: absolute;
  left: 0;
  background-color: ${p => p.theme.colors.gray200};
  width: 1px;
  border-radius: ${p => p.theme.radius.md};
  height: 14px;
`;

const headerCellPlacementStyle = (p: {placement: HeaderCellVariant}) => css`
  ${
    p.placement === 'first' &&
    css`
      grid-column: 1;
    `
  }

  ${
    p.placement === 'remaining' &&
    css`
      grid-column: 2 / -1;
    `
  }

  ${
    p.placement === 'full-width' &&
    css`
      grid-column: 1 / -1;
      padding: 0;
    `
  }
`;

const ColumnHeaderCell = styled(Table.HeadCell, {
  shouldForwardProp: prop => prop !== 'placement',
})<{placement: HeaderCellVariant; align?: ColumnAlign}>`
  outline: none;
  padding: 0 ${p => p.theme.space.xl};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  font-size: ${p => p.theme.font.size.md};
  color: ${p => p.theme.tokens.content.secondary};

  display: flex;
  align-items: center;
  position: relative;
  justify-content: space-between;
  height: 100%;
  --column-resizer-height: 100%;

  ${HeaderCellContent} {
    flex: 1;
    height: 100%;
    min-width: 0;
  }

  ${p =>
    !p.align &&
    css`
      ${HeaderCellContent} {
        justify-content: space-between;
      }
    `}

  ${HeaderCellContent}:focus-visible {
    box-shadow: inset 0 0 0 2px ${p => p.theme.tokens.focus.default};
  }

  &:first-child {
    ${HeaderDivider} {
      display: none;
    }
  }

  &[aria-sort] {
    color: ${p => p.theme.tokens.content.primary};
  }

  ${headerCellPlacementStyle}
`;

const ResultsHeaderCell = styled(Table.HeadCell, {
  shouldForwardProp: prop => prop !== 'isFirst' && prop !== 'placement',
})<{placement: HeaderCellVariant; isFirst?: boolean}>`
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

  ${headerCellPlacementStyle}
`;

const rowLinkStyle = (p: {theme: Theme}) => css`
  /** Adjust margin/padding to account for StyledRowCell padding */
  margin: -${p.theme.space.lg} -${p.theme.space.xl};
  padding: ${p.theme.space.lg} ${p.theme.space.xl};

  /** Ensure cursor is set in case this is applied to a div */
  cursor: pointer;

  &:before {
    content: '';
    position: absolute;
    inset: 0;
  }
`;

const FullWidthCell = styled(RowCell)`
  grid-column: 1 / -1;
  ${fullWidthCellStyle}
`;

function FullWidthRow({children, ...props}: RowProps) {
  return (
    <Row {...props}>
      <FullWidthCell>{children}</FullWidthCell>
    </Row>
  );
}

SimpleTable.Body = Table.Body;
SimpleTable.Empty = TableEmpty;
SimpleTable.Error = TableError;
SimpleTable.FullWidthCell = FullWidthCell;
SimpleTable.FullWidthRow = FullWidthRow;
SimpleTable.Head = Head;
SimpleTable.HeaderCell = HeaderCell;
SimpleTable.HeaderRow = HeaderRow;
SimpleTable.Loading = TableLoading;
SimpleTable.Row = Row;
SimpleTable.RowCell = RowCell;
SimpleTable.rowLinkStyle = rowLinkStyle;
SimpleTable.VariantProvider = VariantProvider;
