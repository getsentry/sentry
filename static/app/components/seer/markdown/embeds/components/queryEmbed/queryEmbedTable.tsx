import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import {Text} from '@sentry/scraps/text';

import {QUERY_EMBED_ROW_LIMIT} from 'sentry/components/seer/markdown/embeds/components/queryEmbed/queryEmbedConstants';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import type {ColumnType} from 'sentry/utils/discover/fields';
import {
  aggregateOutputType,
  fieldAlignment,
  getAggregateAlias,
} from 'sentry/utils/discover/fields';
import {formatTooltipValue} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatTooltipValue';

/**
 * A raw `1234` is not a duration a reader can scan — `1.23s` is. The events
 * API reports a type and a unit per field, and `formatTooltipValue` already
 * dispatches on exactly that pair, so a cell borrows the formatting its own
 * chart would use rather than growing a second dialect of it.
 */
function formatCellValue(
  value: unknown,
  type: ColumnType,
  unit: string | undefined
): string {
  if (value === undefined || value === null || value === '') {
    return '—';
  }

  if (typeof value === 'number') {
    return formatTooltipValue(value, type, unit);
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'boolean' || typeof value === 'bigint') {
    return value.toString();
  }

  return JSON.stringify(value) ?? '—';
}

/**
 * The type and unit the API reported for a field, under whichever of the two
 * spellings the response used — `meta` keys a function by the same alias its
 * rows do. Absent meta, an aggregate still names its own output type.
 */
function fieldFormat(field: string, meta: EventsMetaType | undefined) {
  const alias = getAggregateAlias(field);
  const type: ColumnType =
    meta?.fields?.[field] ?? meta?.fields?.[alias] ?? aggregateOutputType(field);

  return {
    type,
    unit: meta?.units?.[field] ?? meta?.units?.[alias] ?? undefined,
    // Discover already keeps the list of field types that read as numbers: it
    // right-aligns exactly those. Borrow that judgement instead of keeping a
    // second copy of the list here for it to drift from.
    isNumeric: fieldAlignment(field, type) === 'right',
  };
}

export interface QueryEmbedColumn<Row> {
  key: string;
  /**
   * Rendered into the cell as-is. A column of plain values is responsible for
   * its own truncation — see `eventColumns` — so that a column of rich content
   * isn't forced into a text context that would mangle it.
   */
  render: (row: Row) => ReactNode;
  /** Header text. Defaults to `key`, which is what a field-named column wants. */
  label?: ReactNode;
  /**
   * Whether the reader can drag the column wider. Defaults to `true`; a column
   * whose content never varies in size, like an icon, has nothing to reveal.
   */
  resizable?: boolean;
  /**
   * Grid track for the column. Defaults to an equal share of the leftover
   * space; a column of fixed-size content — an icon, say — should ask for
   * `max-content` instead of being stretched to match a column of text.
   */
  width?: string;
}

/**
 * Columns for a table backed by `/organizations/$org/events/`, whose rows are
 * keyed by field name. The aggregate alias fallback is what lets a column
 * named `count_unique(user)` read the `count_unique_user` key the API returns.
 */
export function eventColumns<Row extends Record<string, unknown>>(
  fields: string[],
  meta?: EventsMetaType
): Array<QueryEmbedColumn<Row>> {
  return fields.map(field => {
    const alias = getAggregateAlias(field);
    const {isNumeric, type, unit} = fieldFormat(field, meta);

    return {
      key: field,
      render: (row: Row) => (
        <Text ellipsis tabular={isNumeric}>
          {formatCellValue(row[field] ?? row[alias], type, unit)}
        </Text>
      ),
    };
  });
}

/** Rows from `/events/` carry an `id`; fall back to position for aggregates. */
export function eventRowKey(row: {id?: string | number}, index: number): string {
  return String(row.id ?? index);
}

interface QueryEmbedTableProps<Row> {
  columns: Array<QueryEmbedColumn<Row>>;
  emptyMessage: string;
  errorMessage: string;
  isError: boolean;
  isPending: boolean;
  rows: Row[];
  rowKey?: (row: Row, index: number) => string;
}

/**
 * The preview table every query embed shares: resizable columns, ellipsised
 * cells, and the three async states. Rows are read-only by construction —
 * cells render values, never controls — and the column widths a reader drags
 * stay inside the embed, so neither can reach the host page (see the embeds
 * README).
 */
export function QueryEmbedTable<Row>({
  columns,
  emptyMessage,
  errorMessage,
  isError,
  isPending,
  rowKey,
  rows,
}: QueryEmbedTableProps<Row>) {
  // The widths here are only a default; the split a query actually needs is
  // something only the reader knows. `SimpleTable` makes its columns
  // unresizable by default, so opt each one back in and point its head cell,
  // which is what carries the handle, at it by index.
  const columnConfig = columns.map((column, index) => ({
    key: column.key,
    resizable: column.resizable ?? true,
    width: column.width ?? (index === 0 ? 'minmax(0, 2fr)' : 'minmax(0, 1fr)'),
  }));

  return (
    <FlushTable
      columns={columnConfig}
      header={
        <SimpleTable.HeaderRow>
          {columns.map((column, index) => (
            <SimpleTable.HeaderCell columnIndex={index} key={column.key}>
              {/* `inherit` keeps the header cell's own secondary color rather
                  than resetting the label to Text's primary default. */}
              <Text ellipsis variant="inherit">
                {column.label ?? column.key}
              </Text>
            </SimpleTable.HeaderCell>
          ))}
        </SimpleTable.HeaderRow>
      }
    >
      {isPending ? (
        <SimpleTable.Loading />
      ) : isError ? (
        <SimpleTable.Empty>{errorMessage}</SimpleTable.Empty>
      ) : rows.length === 0 ? (
        <SimpleTable.Empty>{emptyMessage}</SimpleTable.Empty>
      ) : (
        rows.slice(0, QUERY_EMBED_ROW_LIMIT).map((row, index) => (
          <SimpleTable.Row key={rowKey?.(row, index) ?? index}>
            {columns.map(column => (
              <SimpleTable.RowCell key={column.key}>
                {column.render(row)}
              </SimpleTable.RowCell>
            ))}
          </SimpleTable.Row>
        ))
      )}
    </FlushTable>
  );
}

/**
 * The table runs edge to edge in `QueryEmbedCard`, whose own border already
 * frames it, so `SimpleTable`'s border and rounding would draw a second box
 * inside the first. Only the top rule stays, dividing the header from the
 * card's header band or the query above it.
 */
const FlushTable = styled(SimpleTable)`
  border-width: 1px 0 0;
  border-radius: 0;

  > thead > tr {
    border-radius: 0;
  }
`;
