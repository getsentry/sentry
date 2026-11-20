import type {Column} from 'sentry/utils/discover/fields';

import {
  addEquationRow,
  addMetricRow,
  deleteRow,
  fieldsFromRows,
  getEquationLabels,
  getHiddenAggregates,
  getReferenceMap,
  isRowReferenced,
  moveRow,
  rowsFromFields,
  setEquationExpression,
  setRowAlias,
  setRowField,
  setRowVisible,
  type MetricRow,
  type TraceMetricRow,
} from './rowModel';

const SUM_FOO = 'sum(value,foo,counter,none)';
const SUM_BAR = 'sum(value,bar,counter,none)';
const COUNT_FOO = 'count(value,foo,counter,none)';
const SUM_BAZ_FILTERED = 'sum_if(`release:1.0`,value,baz,counter,none)';

function fn(aggregate: string, alias?: string): Column {
  const [name, args] = aggregate.replace(/\)$/, '').split('(');
  return {
    kind: 'function',
    function: [name as any, ...(args!.split(',') as [string, ...string[]])],
    alias,
  };
}

function eq(expression: string, alias?: string): Column {
  return {kind: 'equation', field: expression, alias};
}

function col(field: string): Column {
  return {kind: 'field', field};
}

function letters(rows: TraceMetricRow[]): string[] {
  return rows.map(row => (row.kind === 'metric' ? row.letter : row.kind));
}

function metric(rows: TraceMetricRow[], letter: string): MetricRow {
  const row = rows.find(r => r.kind === 'metric' && r.letter === letter);
  if (row?.kind !== 'metric') {
    throw new Error(`No metric row ${letter}`);
  }
  return row;
}

describe('rowModel', () => {
  describe('rowsFromFields', () => {
    it('gives visible aggregates letters in order and keeps columns', () => {
      const rows = rowsFromFields([col('transaction'), fn(SUM_FOO), fn(SUM_BAR)]);

      expect(letters(rows)).toEqual(['column', 'A', 'B']);
      expect(rows.every(row => row.id)).toBe(true);
    });

    it('makes a hidden row above the equation for an aggregate only it uses', () => {
      const rows = rowsFromFields([fn(SUM_FOO), eq(`${SUM_FOO} / ${SUM_BAR}`)]);

      expect(letters(rows)).toEqual(['A', 'B', 'equation']);
      expect(metric(rows, 'B').visible).toBe(false);
      expect(rows[2]).toMatchObject({kind: 'equation', expression: 'A / B'});
    });

    it('gives repeated uses of a shared aggregate distinct letters', () => {
      const rows = rowsFromFields([
        fn(SUM_FOO),
        fn(SUM_FOO),
        eq(`${SUM_FOO} + ${SUM_FOO}`),
      ]);

      expect(rows[2]).toMatchObject({expression: 'A + B'});
    });

    it('leaves functions without a metric as text', () => {
      const rows = rowsFromFields([eq('performance_score() * 100')]);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({expression: 'performance_score() * 100'});
    });

    it('keeps conditional aggregates intact', () => {
      const rows = rowsFromFields([eq(`${SUM_BAZ_FILTERED} * 2`)]);

      expect(getHiddenAggregates(rows)).toEqual([SUM_BAZ_FILTERED]);
    });
  });

  describe('fieldsFromRows', () => {
    it('round-trips the saved shape', () => {
      const fields = [
        col('transaction'),
        fn(SUM_FOO, 'Foo'),
        eq(`${SUM_FOO} / ${SUM_BAR}`, 'Ratio'),
      ];

      expect(fieldsFromRows(rowsFromFields(fields))).toEqual(fields);
    });

    it('leaves hidden rows out', () => {
      const rows = setRowVisible(
        rowsFromFields([fn(SUM_FOO), eq(`${SUM_FOO} * 2`)]),
        metric(rowsFromFields([fn(SUM_FOO)]), 'A').id,
        false
      );
      // The id above came from a different model, so nothing was hidden.
      expect(fieldsFromRows(rows)).toHaveLength(2);

      const hidden = setRowVisible(rows, metric(rows, 'A').id, false);
      expect(fieldsFromRows(hidden)).toEqual([eq(`${SUM_FOO} * 2`)]);
    });
  });

  describe('editing', () => {
    it('keeps letters and the equation when rows are reordered', () => {
      const rows = rowsFromFields([
        fn(SUM_FOO),
        fn(SUM_BAR),
        eq(`${SUM_FOO} + ${SUM_BAR}`),
      ]);

      const moved = moveRow(rows, 1, 0);

      expect(letters(moved)).toEqual(['B', 'A', 'equation']);
      expect(moved[2]).toMatchObject({expression: 'A + B'});
      expect(fieldsFromRows(moved)).toEqual([
        fn(SUM_BAR),
        fn(SUM_FOO),
        eq(`${SUM_FOO} + ${SUM_BAR}`),
      ]);
    });

    it('keeps a hidden row in place with its letter', () => {
      const rows = rowsFromFields([
        fn(SUM_FOO),
        fn(SUM_BAR),
        eq(`${SUM_FOO} + ${SUM_BAR}`),
      ]);

      const hidden = setRowVisible(rows, metric(rows, 'A').id, false);

      expect(letters(hidden)).toEqual(['A', 'B', 'equation']);
      expect(metric(hidden, 'A').visible).toBe(false);
      expect(fieldsFromRows(hidden)).toEqual([
        fn(SUM_BAR),
        eq(`${SUM_FOO} + ${SUM_BAR}`),
      ]);

      const shown = setRowVisible(hidden, metric(hidden, 'A').id, true);
      expect(fieldsFromRows(shown)).toEqual(fieldsFromRows(rows));
    });

    it('does not touch the equation when a row changes aggregate', () => {
      const rows = rowsFromFields([
        fn(SUM_FOO),
        fn(SUM_FOO),
        eq(`${SUM_FOO} + ${SUM_FOO}`),
      ]);

      const edited = setRowField(rows, metric(rows, 'B').id, fn(COUNT_FOO));

      expect(edited[2]).toMatchObject({expression: 'A + B'});
      expect(fieldsFromRows(edited)).toEqual([
        fn(SUM_FOO),
        fn(COUNT_FOO),
        eq(`${SUM_FOO} + ${COUNT_FOO}`),
      ]);
    });

    it('gives a column a letter when it becomes an aggregate', () => {
      const rows = rowsFromFields([col('transaction'), fn(SUM_FOO)]);

      const edited = setRowField(rows, rows[0]!.id, fn(SUM_BAR));

      expect(letters(edited)).toEqual(['B', 'A']);
      expect(edited[0]!.id).toBe(rows[0]!.id);
    });

    it('drops hidden rows an equation no longer names', () => {
      const rows = rowsFromFields([fn(SUM_FOO), eq(`${SUM_FOO} / ${SUM_BAR}`)]);
      expect(letters(rows)).toEqual(['A', 'B', 'equation']);

      const edited = setEquationExpression(rows, rows[2]!.id, 'A * 2');
      expect(letters(edited)).toEqual(['A', 'equation']);

      const deleted = deleteRow(rows, rows[2]!.id);
      expect(letters(deleted)).toEqual(['A']);
    });

    it('reports which rows an equation names', () => {
      const rows = rowsFromFields([fn(SUM_FOO), fn(SUM_BAR), eq(`${SUM_FOO} * 2`)]);

      expect(isRowReferenced(rows, metric(rows, 'A').id)).toBe(true);
      expect(isRowReferenced(rows, metric(rows, 'B').id)).toBe(false);
    });

    it('adds rows with the next free letter', () => {
      let rows = rowsFromFields([fn(SUM_FOO), fn(SUM_BAR)]);
      rows = deleteRow(rows, metric(rows, 'A').id);

      rows = addMetricRow(rows, fn(COUNT_FOO));
      rows = addEquationRow(rows);

      expect(letters(rows)).toEqual(['B', 'A', 'equation']);
      expect(getEquationLabels(rows).get(rows[2]!.id)).toBe('ƒ1');
    });

    it('sets aliases on metric and equation rows', () => {
      let rows = rowsFromFields([fn(SUM_FOO), eq(`${SUM_FOO} * 2`)]);

      rows = setRowAlias(rows, rows[0]!.id, 'Foo');
      rows = setRowAlias(rows, rows[1]!.id, 'Double');

      expect(fieldsFromRows(rows)).toEqual([
        fn(SUM_FOO, 'Foo'),
        eq(`${SUM_FOO} * 2`, 'Double'),
      ]);
    });

    it('builds the reference map from every metric row', () => {
      const rows = rowsFromFields([fn(SUM_FOO), eq(`${SUM_FOO} / ${SUM_BAR}`)]);

      expect(getReferenceMap(rows)).toEqual({A: SUM_FOO, B: SUM_BAR});
    });
  });

  describe('reconciling with outside changes', () => {
    it('keeps ids and letters when the state fields still match', () => {
      const rows = rowsFromFields([
        fn(SUM_FOO),
        fn(SUM_BAR),
        eq(`${SUM_FOO} + ${SUM_BAR}`),
      ]);
      const moved = moveRow(rows, 1, 0);

      const next = rowsFromFields(fieldsFromRows(moved), moved);

      expect(next.map(row => row.id)).toEqual(moved.map(row => row.id));
      expect(letters(next)).toEqual(['B', 'A', 'equation']);
      expect(next[2]).toMatchObject({expression: 'A + B'});
    });

    it('keeps letters when a y-axis cap drops trailing rows', () => {
      const rows = rowsFromFields([fn(SUM_FOO), fn(SUM_BAR), fn(COUNT_FOO)]);
      const trimmed = rowsFromFields([fn(SUM_FOO), fn(SUM_BAR)], rows);

      expect(trimmed.map(row => row.id)).toEqual(rows.slice(0, 2).map(row => row.id));
      expect(letters(trimmed)).toEqual(['A', 'B']);
    });

    it('keeps a hidden row where it was when fields change elsewhere', () => {
      const rows = rowsFromFields([
        fn(SUM_FOO),
        fn(SUM_BAR),
        eq(`${SUM_FOO} + ${SUM_BAR}`),
      ]);
      const hidden = setRowVisible(rows, metric(rows, 'A').id, false);

      // Something outside the list appended a row to the saved fields.
      const next = rowsFromFields([...fieldsFromRows(hidden), fn(COUNT_FOO)], hidden);

      expect(letters(next)).toEqual(['A', 'B', 'equation', 'C']);
      expect(metric(next, 'A')).toMatchObject({id: metric(rows, 'A').id, visible: false});
      expect(next[2]).toMatchObject({expression: 'A + B'});
    });

    it('gives new letters to rows it cannot match', () => {
      const rows = rowsFromFields([fn(SUM_FOO)]);

      const next = rowsFromFields([fn(SUM_BAR), fn(SUM_FOO)], rows);

      expect(letters(next)).toEqual(['B', 'A']);
      expect(metric(next, 'A').id).toBe(rows[0]!.id);
    });
  });
});
