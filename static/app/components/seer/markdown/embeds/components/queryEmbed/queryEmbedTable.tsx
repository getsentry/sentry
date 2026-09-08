import type {ReactNode} from 'react';

import {Text} from '@sentry/scraps/text';

import {QUERY_EMBED_ROW_LIMIT} from 'sentry/components/seer/markdown/embeds/components/queryEmbed/queryEmbedConstants';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {getAggregateAlias} from 'sentry/utils/discover/fields';
import {formatNumber} from 'sentry/utils/number/formatNumber';

function formatCellValue(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return '—';
  }

  if (typeof value === 'number') {
    return String(formatNumber(value));
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'boolean' || typeof value === 'bigint') {
    return value.toString();
  }

  return JSON.stringify(value) ?? '—';
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
  fields: string[]
): Array<QueryEmbedColumn<Row>> {
  return fields.map(field => ({
    key: field,
    render: (row: Row) => (
      <Text ellipsis>{formatCellValue(row[field] ?? row[getAggregateAlias(field)])}</Text>
    ),
  }));
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
  // unresizable by default, so opt each one back in and name it from its head
  // cell, which is what carries the handle.
  const columnConfig = columns.map((column, index) => ({
    key: column.key,
    resizable: true,
    width: column.width ?? (index === 0 ? 'minmax(0, 2fr)' : 'minmax(0, 1fr)'),
  }));

  return (
    <SimpleTable
      columns={columnConfig}
      header={
        <SimpleTable.HeaderRow>
          {columns.map(column => (
            <SimpleTable.HeaderCell columnKey={column.key} key={column.key}>
              <Text ellipsis>{column.label ?? column.key}</Text>
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
    </SimpleTable>
  );
}
