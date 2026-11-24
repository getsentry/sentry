import uniqueId from 'lodash/uniqueId';

import {
  isTokenFreeText,
  isTokenFunction,
  isTokenReference,
} from 'sentry/components/arithmeticBuilder/token';
import {tokenizeExpression} from 'sentry/components/arithmeticBuilder/tokenizer';
import {
  explodeFieldString,
  generateFieldAsString,
  type Column,
} from 'sentry/utils/discover/fields';
import {extractTraceMetricFromColumn} from 'sentry/views/dashboards/widgetBuilder/utils/buildTraceMetricAggregate';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {getFunctionLabel} from 'sentry/views/explore/utils/getFunctionLabel';

/**
 * The editing model behind the unified trace metrics visualize list.
 *
 * A saved widget is a flat list of columns where equations are plain text with
 * the aggregates written inline. That shape has no row identity, so labels
 * and hidden rows cannot survive edits. This model gives every row an id and
 * gives metric rows a label that never changes. Equations are kept in label
 * form while editing. `fieldsFromRows` turns the model back into the saved
 * shape; `rowsFromFields` builds the model from it, reusing an earlier model
 * when there is one so ids and labels are kept.
 *
 * @public used by the unified visualize list in a follow-up PR
 */
export interface MetricRow {
  field: Column;
  id: string;
  kind: 'metric';
  /**
   * Stable reference label (A, B, ...). Handed out once, never reassigned.
   */
  label: string;
  /**
   * Hidden rows only feed equations. They are not saved on the widget.
   */
  visible: boolean;
}

/**
 * A plain group-by column in a table.
 * @public used by the unified visualize list in a follow-up PR
 */
export interface ColumnRow {
  field: Column;
  id: string;
  kind: 'column';
}

/**
 * An equation over the metric rows.
 * @public used by the unified visualize list in a follow-up PR
 */
export interface EquationRow {
  /**
   * The equation in label form, e.g. `A + B`.
   */
  expression: string;
  id: string;
  kind: 'equation';
  alias?: string;
}

export type TraceMetricRow = MetricRow | ColumnRow | EquationRow;

/**
 * Normalizes an aggregate string so equivalent spellings compare equal.
 * @public used by the unified visualize list in a follow-up PR
 */
export function getAggregateKey(aggregate: string): string {
  return generateFieldAsString(explodeFieldString(aggregate));
}

function newRowId(): string {
  return uniqueId('trace-metric-row-');
}

function columnKey(field: Column): string {
  return field.kind === FieldValueKind.FUNCTION
    ? getAggregateKey(generateFieldAsString(field))
    : generateFieldAsString(field);
}

function isMetricRow(row: TraceMetricRow): row is MetricRow {
  return row.kind === 'metric';
}

function isEquationRow(row: TraceMetricRow): row is EquationRow {
  return row.kind === 'equation';
}

function getLabels(rows: TraceMetricRow[]): Set<string> {
  return new Set(rows.filter(isMetricRow).map(row => row.label));
}

function getNextLabel(rows: TraceMetricRow[]): string {
  const used = getLabels(rows);
  let index = 0;
  while (used.has(getFunctionLabel(index))) {
    index++;
  }
  return getFunctionLabel(index);
}

/**
 * Label to aggregate text, for every metric row, visible or hidden.
 * @public used by the unified visualize list in a follow-up PR
 */
export function getReferenceMap(rows: TraceMetricRow[]): Record<string, string> {
  return Object.fromEntries(
    rows.filter(isMetricRow).map(row => [row.label, generateFieldAsString(row.field)])
  );
}

/**
 * Labels named by at least one equation.
 */
function getReferencedLabels(rows: TraceMetricRow[]): Set<string> {
  const labels = getLabels(rows);
  const referenced = new Set<string>();
  for (const row of rows) {
    if (!isEquationRow(row)) {
      continue;
    }
    for (const token of tokenizeExpression(row.expression, labels)) {
      if (isTokenReference(token)) {
        referenced.add(token.text);
      }
    }
  }
  return referenced;
}

/**
 * Whether an equation names this metric row.
 * @public used by the unified visualize list in a follow-up PR
 */
export function isRowReferenced(rows: TraceMetricRow[], id: string): boolean {
  const row = rows.find(r => r.id === id);
  return !!row && isMetricRow(row) && getReferencedLabels(rows).has(row.label);
}

/**
 * Equation labels (ƒ1, ƒ2, ...) by equation order, keyed by row id.
 * @public used by the unified visualize list in a follow-up PR
 */
export function getEquationLabels(rows: TraceMetricRow[]): Map<string, string> {
  const labels = new Map<string, string>();
  let index = 1;
  for (const row of rows) {
    if (isEquationRow(row)) {
      labels.set(row.id, `ƒ${index++}`);
    }
  }
  return labels;
}

/**
 * Aggregates of the hidden rows, as saved-form strings.
 * @public used by the unified visualize list in a follow-up PR
 */
export function getHiddenAggregates(rows: TraceMetricRow[]): string[] {
  return rows
    .filter((row): row is MetricRow => isMetricRow(row) && !row.visible)
    .map(row => generateFieldAsString(row.field));
}

/**
 * Label form to saved form. Labels that match no row are left as typed.
 */
function resolveExpression(
  expression: string,
  referenceMap: Record<string, string>
): string {
  return tokenizeExpression(expression, new Set(Object.keys(referenceMap)))
    .map(token => {
      if (isTokenReference(token) && token.text in referenceMap) {
        return referenceMap[token.text]!;
      }
      return isTokenFreeText(token) ? '' : token.text;
    })
    .filter(text => text.length > 0)
    .join(' ');
}

/**
 * Saved form to label form. An aggregate takes the first row that provides
 * it, as in Explore, so `x + x` with rows A and B both on `x` reads as
 * `A + A`. Functions without a row stay as text.
 */
function unresolveExpression(
  expression: string,
  referenceMap: Record<string, string>
): string {
  const labelByKey = new Map<string, string>();
  for (const [label, aggregate] of Object.entries(referenceMap)) {
    const key = getAggregateKey(aggregate);
    if (!labelByKey.has(key)) {
      labelByKey.set(key, label);
    }
  }

  return tokenizeExpression(expression)
    .map(token =>
      isTokenFunction(token)
        ? (labelByKey.get(getAggregateKey(token.text)) ?? token.text)
        : token.text
    )
    .filter(text => text.length > 0)
    .join(' ');
}

/**
 * Unique metric aggregates inside a saved-form equation, in order of first use.
 */
function getEquationAggregates(equation: string): string[] {
  const seen = new Set<string>();
  const aggregates: string[] = [];
  for (const token of tokenizeExpression(equation)) {
    if (!isTokenFunction(token)) {
      continue;
    }
    const key = getAggregateKey(token.text);
    if (seen.has(key) || !extractTraceMetricFromColumn(explodeFieldString(token.text))) {
      continue;
    }
    seen.add(key);
    aggregates.push(token.text);
  }
  return aggregates;
}

/**
 * Drops hidden rows that no equation names any more.
 */
function pruneOrphanHiddenRows(rows: TraceMetricRow[]): TraceMetricRow[] {
  const referenced = getReferencedLabels(rows);
  return rows.filter(
    row => !isMetricRow(row) || row.visible || referenced.has(row.label)
  );
}

/**
 * The saved shape: visible metric rows, column rows and equations in row
 * order, with equations resolved to inline text. Hidden rows are left out.
 * @public used by the unified visualize list in a follow-up PR
 */
export function fieldsFromRows(rows: TraceMetricRow[]): Column[] {
  const referenceMap = getReferenceMap(rows);
  const fields: Column[] = [];
  for (const row of rows) {
    if (isEquationRow(row)) {
      fields.push({
        kind: FieldValueKind.EQUATION,
        field: resolveExpression(row.expression, referenceMap),
        alias: row.alias,
      });
    } else if (!isMetricRow(row) || row.visible) {
      fields.push(row.field);
    }
  }
  return fields;
}

/**
 * Builds the model from the saved shape.
 *
 * With `previous`, rows are matched back by kind and value, in order, so ids
 * and labels are kept across changes made outside the list (a display type
 * switch, a sort fix-up). An equation whose labels still produce its saved
 * text keeps those labels and the hidden rows they name. Anything unmatched
 * gets a new id and the next free label.
 * @public used by the unified visualize list in a follow-up PR
 */
export function rowsFromFields(
  fields: Column[],
  previous: TraceMetricRow[] = []
): TraceMetricRow[] {
  const unused = new Set(previous);
  const take = (match: (row: TraceMetricRow) => boolean): TraceMetricRow | undefined => {
    for (const row of unused) {
      if (match(row)) {
        unused.delete(row);
        return row;
      }
    }
    return undefined;
  };

  // An aggregate any visible field provides needs no hidden row, even when
  // that field comes after the equation.
  const visibleKeys = new Set(
    fields
      .filter(field => field.kind === FieldValueKind.FUNCTION)
      .map(field => columnKey(field))
  );

  // Pair equation fields with the previous equation rows, in order. Where the
  // old labels still spell the saved text, reserve the rows they name that no
  // visible field will match: hidden rows, so a visible field with the same
  // aggregate cannot claim them, and visible rows whose field went away, which
  // become hidden rows.
  const previousMap = getReferenceMap(previous);
  const previousLabels = new Set(Object.keys(previousMap));
  const previousEquations = previous.filter(isEquationRow);
  const reusedHidden: Array<{index: number; row: MetricRow}> = [];
  const equationMatches = new Map<number, {keepsLabels: boolean; row: EquationRow}>();
  fields.forEach((field, fieldIndex) => {
    if (field.kind !== FieldValueKind.EQUATION) {
      return;
    }
    const match = previousEquations[equationMatches.size];
    if (!match) {
      return;
    }
    unused.delete(match);
    const keepsLabels = resolveExpression(match.expression, previousMap) === field.field;
    equationMatches.set(fieldIndex, {row: match, keepsLabels});
    if (!keepsLabels) {
      return;
    }
    for (const token of tokenizeExpression(match.expression, previousLabels)) {
      if (!isTokenReference(token)) {
        continue;
      }
      const named = previous.find(row => isMetricRow(row) && row.label === token.text);
      if (
        named &&
        isMetricRow(named) &&
        unused.has(named) &&
        (!named.visible || !visibleKeys.has(columnKey(named.field)))
      ) {
        unused.delete(named);
        reusedHidden.push({
          index: previous.indexOf(named),
          row: {...named, visible: false},
        });
      }
    }
  });

  const rows: TraceMetricRow[] = [];
  const pendingEquations: Array<{reused: boolean; row: EquationRow; text: string}> = [];

  const hasMetric = (key: string) =>
    visibleKeys.has(key) ||
    rows.some(row => isMetricRow(row) && columnKey(row.field) === key) ||
    reusedHidden.some(({row}) => columnKey(row.field) === key);

  fields.forEach((field, fieldIndex) => {
    if (field.kind === FieldValueKind.FIELD) {
      const key = columnKey(field);
      const match = take(row => row.kind === 'column' && columnKey(row.field) === key);
      rows.push({id: match?.id ?? newRowId(), kind: 'column', field});
      return;
    }

    if (field.kind === FieldValueKind.FUNCTION) {
      const key = columnKey(field);
      // Prefer a row that was already visible, so a hidden twin keeps its own
      // id and label.
      const match =
        take(row => isMetricRow(row) && row.visible && columnKey(row.field) === key) ??
        take(row => isMetricRow(row) && columnKey(row.field) === key);
      rows.push({
        id: match?.id ?? newRowId(),
        kind: 'metric',
        label: match && isMetricRow(match) ? match.label : '',
        field,
        visible: true,
      });
      return;
    }

    if (field.kind === FieldValueKind.EQUATION) {
      const match = equationMatches.get(fieldIndex);
      if (!match?.keepsLabels) {
        for (const aggregate of getEquationAggregates(field.field)) {
          const key = getAggregateKey(aggregate);
          if (hasMetric(key)) {
            continue;
          }
          const column = explodeFieldString(aggregate);
          const hidden = take(row => isMetricRow(row) && columnKey(row.field) === key);
          if (hidden && isMetricRow(hidden)) {
            reusedHidden.push({
              index: previous.indexOf(hidden),
              row: {...hidden, field: column, visible: false},
            });
          } else {
            rows.push({
              id: newRowId(),
              kind: 'metric',
              label: '',
              field: column,
              visible: false,
            });
          }
        }
      }
      const row: EquationRow = {
        id: match?.row.id ?? newRowId(),
        kind: 'equation',
        expression: match?.row.expression ?? '',
        alias: field.alias,
      };
      rows.push(row);
      pendingEquations.push({row, reused: !!match, text: field.field});
    }
  });

  reusedHidden.sort((a, b) => a.index - b.index);
  for (const {index, row} of reusedHidden) {
    rows.splice(Math.min(index, rows.length), 0, row);
  }

  // New metric rows take the next free label, in display order.
  for (const row of rows) {
    if (isMetricRow(row) && !row.label) {
      row.label = getNextLabel(rows);
    }
  }

  // An equation keeps the labels it had when they still mean the same text;
  // otherwise the labels are derived from the text.
  const referenceMap = getReferenceMap(rows);
  for (const {row, reused, text} of pendingEquations) {
    if (!(reused && resolveExpression(row.expression, referenceMap) === text)) {
      row.expression = unresolveExpression(text, referenceMap);
    }
  }

  return pruneOrphanHiddenRows(rows);
}

/**
 * Moves the row at `from` to `to`. Labels travel with their rows.
 * @public used by the unified visualize list in a follow-up PR
 */
export function moveRow(
  rows: TraceMetricRow[],
  from: number,
  to: number
): TraceMetricRow[] {
  const next = [...rows];
  const [row] = next.splice(from, 1);
  if (!row) {
    return rows;
  }
  next.splice(to, 0, row);
  return next;
}

/**
 * Hides a metric row from the chart or shows it again. The row stays put.
 * @public used by the unified visualize list in a follow-up PR
 */
export function setRowVisible(
  rows: TraceMetricRow[],
  id: string,
  visible: boolean
): TraceMetricRow[] {
  return rows.map(row => (row.id === id && isMetricRow(row) ? {...row, visible} : row));
}

/**
 * Removes a row. Hidden rows no equation names afterwards go with it.
 * @public used by the unified visualize list in a follow-up PR
 */
export function deleteRow(rows: TraceMetricRow[], id: string): TraceMetricRow[] {
  return pruneOrphanHiddenRows(rows.filter(row => row.id !== id));
}

/**
 * Replaces the column of a metric or column row. A row that changes kind, for
 * example a table column becoming an aggregate, keeps its id and takes a
 * label when it becomes a metric row.
 * @public used by the unified visualize list in a follow-up PR
 */
export function setRowField(
  rows: TraceMetricRow[],
  id: string,
  field: Column
): TraceMetricRow[] {
  return rows.map(row => {
    if (row.id !== id || isEquationRow(row)) {
      return row;
    }
    if (field.kind === FieldValueKind.FUNCTION) {
      return isMetricRow(row)
        ? {...row, field}
        : {id: row.id, kind: 'metric', label: getNextLabel(rows), field, visible: true};
    }
    return {id: row.id, kind: 'column', field};
  });
}

/**
 * Sets the legend alias of a row.
 * @public used by the unified visualize list in a follow-up PR
 */
export function setRowAlias(
  rows: TraceMetricRow[],
  id: string,
  alias: string | undefined
): TraceMetricRow[] {
  return rows.map(row => {
    if (row.id !== id) {
      return row;
    }
    return isEquationRow(row) ? {...row, alias} : {...row, field: {...row.field, alias}};
  });
}

/**
 * Sets an equation's label-form expression.
 * @public used by the unified visualize list in a follow-up PR
 */
export function setEquationExpression(
  rows: TraceMetricRow[],
  id: string,
  expression: string
): TraceMetricRow[] {
  return pruneOrphanHiddenRows(
    rows.map(row => (row.id === id && isEquationRow(row) ? {...row, expression} : row))
  );
}

/**
 * Appends a visible metric row with the next free label.
 * @public used by the unified visualize list in a follow-up PR
 */
export function addMetricRow(rows: TraceMetricRow[], field: Column): TraceMetricRow[] {
  return [
    ...rows,
    {id: newRowId(), kind: 'metric', label: getNextLabel(rows), field, visible: true},
  ];
}

/**
 * Appends an empty equation row.
 * @public used by the unified visualize list in a follow-up PR
 */
export function addEquationRow(rows: TraceMetricRow[]): TraceMetricRow[] {
  return [...rows, {id: newRowId(), kind: 'equation', expression: ''}];
}
