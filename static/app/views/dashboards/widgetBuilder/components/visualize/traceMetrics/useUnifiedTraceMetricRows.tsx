import {useState} from 'react';

import {generateFieldAsString, type Column} from 'sentry/utils/discover/fields';
import type {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/constants';
import type {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/useWidgetBuilderContext';

import {
  fieldsFromRows,
  getEquationLabels,
  getHiddenAggregates,
  getReferenceMap,
  isRowReferenced,
  moveRow,
  rowsFromFields,
  setEquationExpression,
  setRowField,
  setRowVisible,
  type MetricRow,
  type TraceMetricRow,
} from './rowModel';

type Dispatch = ReturnType<typeof useWidgetBuilderContext>['dispatch'];

interface Options {
  dispatch: Dispatch;
  enabled: boolean;
  fields: Column[];
  updateAction:
    | typeof BuilderStateAction.SET_CATEGORICAL_AGGREGATE
    | typeof BuilderStateAction.SET_FIELDS
    | typeof BuilderStateAction.SET_Y_AXIS;
  /**
   * Time series carry a new-to-old index map so transformations follow rows.
   */
  usesYAxisState: boolean;
  /**
   * Index of the row big number and categorical bar widgets display.
   */
  selectedAggregate?: number;
}

export interface UnifiedTraceMetricRows {
  getExpression: (index: number) => string;
  getLabel: (index: number) => string | undefined;
  hiddenAggregates: string[];
  hiddenRowsByAnchor: Map<number, MetricRow[]>;
  hide: (index: number) => void;
  isReferenced: (index: number) => boolean;
  move: (fromIndex: number, toIndex: number) => void;
  referenceMap: Record<string, string>;
  setExpression: (index: number, expression: string) => void;
  setField: (index: number, field: Column) => void;
  setHiddenRowField: (row: MetricRow, field: Column) => void;
  show: (row: MetricRow) => void;
}

function keyOf(fields: Column[]): string {
  return fields
    .map(field => `${generateFieldAsString(field)}|${field.alias ?? ''}`)
    .join('\n');
}

/**
 * Rows the saved shape keeps, index-aligned with `fieldsFromRows`.
 */
function visibleRowsOf(rows: TraceMetricRow[]): TraceMetricRow[] {
  return rows.filter(row => row.kind !== 'metric' || row.visible);
}

/**
 * Owns the row model for the unified list. Edits write the derived fields to
 * the builder state; changes from elsewhere rebuild the rows, keeping ids and
 * labels.
 */
export function useUnifiedTraceMetricRows({
  dispatch,
  enabled,
  fields,
  selectedAggregate,
  updateAction,
  usesYAxisState,
}: Options): UnifiedTraceMetricRows {
  const fieldsKey = keyOf(fields);
  const [synced, setSynced] = useState(() => ({
    key: fieldsKey,
    rows: rowsFromFields(fields),
  }));

  // Fields changed outside the list.
  let rows = synced.rows;
  if (enabled && synced.key !== fieldsKey) {
    rows = rowsFromFields(fields, synced.rows);
    setSynced({key: fieldsKey, rows});
  }

  const visibleRows = visibleRowsOf(rows);
  const equationLabels = getEquationLabels(rows);

  const commit = (next: TraceMetricRow[]) => {
    const nextFields = fieldsFromRows(next);
    setSynced({key: keyOf(nextFields), rows: next});

    const previousVisible = visibleRows;
    const nextVisible = visibleRowsOf(next);

    // The radio selection is an index, so it follows the row it pointed at.
    const selected =
      selectedAggregate === undefined ? undefined : previousVisible[selectedAggregate];
    const nextSelected = selected
      ? nextVisible.findIndex(row => row.id === selected.id)
      : -1;

    dispatch({
      type: updateAction,
      payload: nextFields,
      ...(usesYAxisState && {
        sourceIndices: nextVisible.map(row =>
          previousVisible.findIndex(previous => previous.id === row.id)
        ),
      }),
      ...(selected &&
        nextSelected !== -1 &&
        nextSelected !== selectedAggregate && {selectedAggregate: nextSelected}),
    });
  };

  const hiddenRowsByAnchor = new Map<number, MetricRow[]>();
  let anchor = 0;
  for (const row of rows) {
    if (row.kind === 'metric' && !row.visible) {
      hiddenRowsByAnchor.set(anchor, [...(hiddenRowsByAnchor.get(anchor) ?? []), row]);
    } else {
      anchor++;
    }
  }

  return {
    hiddenRowsByAnchor,
    hiddenAggregates: getHiddenAggregates(rows),
    referenceMap: getReferenceMap(rows),
    getLabel: index => {
      const row = visibleRows[index];
      if (row?.kind === 'metric') {
        return row.label;
      }
      if (row?.kind === 'equation') {
        return equationLabels.get(row.id);
      }
      return;
    },
    getExpression: index => {
      const row = visibleRows[index];
      return row?.kind === 'equation' ? row.expression : '';
    },
    isReferenced: index => {
      const row = visibleRows[index];
      return !!row && isRowReferenced(rows, row.id);
    },
    hide: index => {
      const row = visibleRows[index];
      if (row) {
        commit(setRowVisible(rows, row.id, false));
      }
    },
    show: row => commit(setRowVisible(rows, row.id, true)),
    move: (fromIndex, toIndex) => {
      const from = visibleRows[fromIndex];
      const to = visibleRows[toIndex];
      if (from && to) {
        commit(moveRow(rows, rows.indexOf(from), rows.indexOf(to)));
      }
    },
    setField: (index, field) => {
      const row = visibleRows[index];
      if (row) {
        commit(setRowField(rows, row.id, field));
      }
    },
    setHiddenRowField: (row, field) => commit(setRowField(rows, row.id, field)),
    setExpression: (index, expression) => {
      const row = visibleRows[index];
      if (row) {
        commit(setEquationExpression(rows, row.id, expression));
      }
    },
  };
}
