import type {ComponentProps, HTMLAttributes, ReactNode, RefObject} from 'react';
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
  fit?: 'max-content';
  /** Defaults to `true`, or to `false` in the `results` variant. */
  flexibleLastColumn?: boolean;
  height?: CSS['height'];
  minimumColumnWidth?: number;
  onColumnResize?: (index: number, width: number) => void;
  prependColumnWidths?: string[];
  ref?: RefObject<HTMLTableElement | null>;
  scrollable?: boolean;
  variant?: SimpleTableVariant;
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

type TableProps = BaseTableProps & TableSectionsProps;

interface RowProps extends HTMLAttributes<HTMLTableRowElement> {
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

function Frame({
  children,
  contentsBody,
  showVerticalScrollbar,
  ...props
}: ComponentProps<typeof Panel> & {
  contentsBody?: boolean;
  showVerticalScrollbar?: boolean;
}) {
  return (
    <StyledFrame showVerticalScrollbar={showVerticalScrollbar} {...props}>
      <PanelBody display={contentsBody ? 'contents' : undefined}>{children}</PanelBody>
    </StyledFrame>
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
}: TableProps) {
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
  customSections,
  flexibleLastColumn = false,
  header,
  variant: _variant,
  ...props
}: TableProps) {
  return (
    <SimpleTableVariantContext value="results">
      <ResultsGrid {...props} flexibleLastColumn={flexibleLastColumn}>
        <TableSections customSections={customSections} header={header}>
          {children}
        </TableSections>
      </ResultsGrid>
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

function Row({children, variant = 'default', ref, ...props}: RowProps) {
  const tableVariant = useSimpleTableVariant();

  if (tableVariant === 'results') {
    return (
      <ResultsRow variant={variant} ref={ref} {...props}>
        {children}
      </ResultsRow>
    );
  }

  return (
    <StyledRow divider variant={variant} ref={ref} {...props}>
      {children}
    </StyledRow>
  );
}

function RowCell({children, ...props}: FlexProps<'td'>) {
  const variant = useSimpleTableVariant();

  if (variant === 'results') {
    return (
      <ResultsRowCell
        as="td"
        role="cell"
        align="center"
        minHeight="42px"
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

interface TableSizingProps {
  fit?: 'max-content';
  height?: CSS['height'];
  scrollable?: boolean;
}

const isTableSizingProp = (prop: string) =>
  prop === 'fit' || prop === 'height' || prop === 'scrollable';

const tableSizingStyle = (p: TableSizingProps) => css`
  ${
    p.scrollable &&
    css`
      overflow-x: auto;
      overflow-y: auto;
    `
  }

  ${
    p.height &&
    css`
      height: 100%;
      max-height: ${p.height};
      flex: 1;
      min-height: 0;
    `
  }

  min-width: ${p.fit};
`;

const StyledTable = styled(Table, {
  shouldForwardProp: prop => !isTableSizingProp(prop),
})<TableSizingProps>`
  background: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  position: relative;
  margin: 0;
  width: 100%;
  overflow: hidden;

  ${tableSizingStyle}
`;

const StyledFrame = styled(Panel, {
  shouldForwardProp: prop => prop !== 'showVerticalScrollbar',
})<{showVerticalScrollbar?: boolean}>`
  overflow-x: auto;
  overflow-y: ${p => (p.showVerticalScrollbar ? 'auto' : 'hidden')};
`;

const ResultsGrid = styled(Table, {
  shouldForwardProp: prop => !isTableSizingProp(prop),
})<TableSizingProps>`
  ${tableSizingStyle}

  /* Pin the header to a definite track height in both layouts; a content-based
     header track lets Safari mis-size the <thead> on back/forward navigation.
     Body track: 1fr absorbs slack when a height is given, else auto. */
  &:has(> thead + tbody) {
    grid-template-rows: ${TABLE_HEAD_ROW_HEIGHT}px ${p => (p.height ? '1fr' : 'auto')};
  }

  &:has(> thead + tbody + tbody) {
    grid-template-rows:
      ${TABLE_HEAD_ROW_HEIGHT}px fit-content(100%)
      ${p => (p.height ? '1fr' : 'auto')};
  }
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

const StyledRow = styled(Table.Row, {
  shouldForwardProp: prop => prop !== 'variant',
})<{variant?: 'default' | 'faded'}>`
  align-items: center;

  ${fadedRowStyle}
`;

const ResultsRow = styled(Table.Row, {
  shouldForwardProp: prop => prop !== 'variant',
})<{variant?: 'default' | 'faded'}>`
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
  shouldForwardProp: prop => prop !== 'placement',
})<{placement: HeaderCellVariant}>`
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
    border-right-color: ${p => p.theme.tokens.border.primary};
  }

  &:not(:first-child):hover {
    border-left-color: ${p => p.theme.tokens.border.primary};
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
SimpleTable.Frame = Frame;
SimpleTable.FullWidthRow = FullWidthRow;
SimpleTable.Head = Head;
SimpleTable.HeaderCell = HeaderCell;
SimpleTable.HeaderRow = HeaderRow;
SimpleTable.Loading = TableLoading;
SimpleTable.Row = Row;
SimpleTable.RowCell = RowCell;
SimpleTable.rowLinkStyle = rowLinkStyle;
SimpleTable.VariantProvider = VariantProvider;
