import type {Column} from 'sentry/utils/discover/fields';

import {
  getAggregateKey,
  getEquationAggregates,
  getUnifiedTraceMetricRows,
  hasDuplicateAggregate,
  isAggregateReferenced,
  replaceAggregateInEquations,
  unresolveEquationWithDuplicates,
} from './unifiedEquations';

const SUM_FOO = 'sum(value,foo,counter,none)';
const SUM_BAR = 'sum(value,bar,counter,none)';
const SUM_BAZ_FILTERED = 'sum_if(`status:500`,value,baz,counter,none)';

function fn(aggregate: string): Column {
  const [name, args] = aggregate.replace(/\)$/, '').split('(');
  return {
    kind: 'function',
    function: [name as any, ...(args!.split(',') as [string, ...string[]])],
  };
}

function eq(equation: string): Column {
  return {kind: 'equation', field: equation};
}

describe('unifiedEquations', () => {
  describe('getEquationAggregates', () => {
    it('returns unique function calls in order', () => {
      expect(getEquationAggregates(`${SUM_FOO} / ${SUM_BAR} + ${SUM_FOO}`)).toEqual([
        SUM_FOO,
        SUM_BAR,
      ]);
    });

    it('keeps conditional aggregates intact', () => {
      expect(getEquationAggregates(`${SUM_BAZ_FILTERED} * 2`)).toEqual([
        SUM_BAZ_FILTERED,
      ]);
    });
  });

  describe('getUnifiedTraceMetricRows', () => {
    it('creates hidden rows for aggregates that only live in an equation', () => {
      const fields = [fn(SUM_FOO), eq(`${SUM_FOO} / ${SUM_BAR}`)];
      const rows = getUnifiedTraceMetricRows(fields);

      expect(rows.hiddenRows).toHaveLength(1);
      expect(rows.hiddenRows[0]!.aggregate).toBe(SUM_BAR);
      expect(rows.hiddenRows[0]!.anchorIndex).toBe(1);
      expect(rows.hiddenRowsByAnchor.get(1)).toHaveLength(1);
    });

    it('labels rows in display order and builds the reference map', () => {
      const fields = [fn(SUM_FOO), eq(`${SUM_BAR} / ${SUM_FOO}`), fn(SUM_BAZ_FILTERED)];
      const rows = getUnifiedTraceMetricRows(fields);

      // A: foo (visible), B: bar (hidden, above the equation), ƒ1, C: baz
      expect(rows.stateLabels.get(0)).toBe('A');
      expect(rows.hiddenLabels.get(SUM_BAR)).toBe('B');
      expect(rows.stateLabels.get(1)).toBe('ƒ1');
      expect(rows.stateLabels.get(2)).toBe('C');
      expect(rows.referenceMap).toEqual({A: SUM_FOO, B: SUM_BAR, C: SUM_BAZ_FILTERED});
    });

    it('keeps a hidden row at its remembered position', () => {
      // foo was row A and then hidden, so it stays first and bar stays B
      const fields = [fn(SUM_BAR), eq(`${SUM_FOO} + ${SUM_BAR}`)];
      const rows = getUnifiedTraceMetricRows(
        fields,
        new Map([[getAggregateKey(SUM_FOO), 0]])
      );

      expect(rows.hiddenLabels.get(SUM_FOO)).toBe('A');
      expect(rows.stateLabels.get(0)).toBe('B');
      expect(rows.hiddenRows[0]!.anchorIndex).toBe(0);
      expect(rows.statePositions.get(0)).toBe(1);
    });

    it('renders a remembered hidden row after the last field', () => {
      const fields = [eq(`${SUM_FOO} * 2`), fn(SUM_BAR)];
      const rows = getUnifiedTraceMetricRows(
        fields,
        new Map([[getAggregateKey(SUM_FOO), 5]])
      );

      expect(rows.hiddenRows[0]!.anchorIndex).toBe(2);
      expect(rows.hiddenRowsByAnchor.get(2)).toHaveLength(1);
      expect(rows.stateLabels.get(1)).toBe('A');
      expect(rows.hiddenLabels.get(SUM_FOO)).toBe('B');
    });

    it('does not make rows for functions without a metric', () => {
      const rows = getUnifiedTraceMetricRows([eq('performance_score()')]);
      expect(rows.hiddenRows).toHaveLength(0);
      expect(rows.stateLabels.get(0)).toBe('ƒ1');
    });

    it('shows a hidden row once when two equations use it', () => {
      const rows = getUnifiedTraceMetricRows([
        eq(`${SUM_BAR} * 2`),
        eq(`${SUM_BAR} * 3`),
      ]);
      expect(rows.hiddenRows).toHaveLength(1);
      expect(rows.hiddenRows[0]!.anchorIndex).toBe(0);
      expect(rows.stateLabels.get(0)).toBe('ƒ1');
      expect(rows.stateLabels.get(1)).toBe('ƒ2');
    });

    it('marks visible aggregates used by an equation as referenced', () => {
      const fields = [fn(SUM_FOO), fn(SUM_BAR), eq(`${SUM_FOO} * 2`)];
      const rows = getUnifiedTraceMetricRows(fields);
      expect(isAggregateReferenced(rows.referencedKeys, fields[0]!)).toBe(true);
      expect(isAggregateReferenced(rows.referencedKeys, fields[1]!)).toBe(false);
    });
  });

  describe('unresolveEquationWithDuplicates', () => {
    it('gives repeated uses of a shared aggregate distinct letters', () => {
      const referenceMap = {A: SUM_FOO, B: SUM_FOO, C: SUM_BAR};

      expect(
        unresolveEquationWithDuplicates(`${SUM_FOO} + ${SUM_FOO}`, referenceMap)
      ).toBe('A + B');
      expect(unresolveEquationWithDuplicates(`${SUM_BAR} * 2`, referenceMap)).toBe(
        'C * 2'
      );
    });

    it('leaves functions without a row as text', () => {
      expect(unresolveEquationWithDuplicates('performance_score() * 100', {})).toBe(
        'performance_score() * 100'
      );
    });
  });

  describe('hasDuplicateAggregate', () => {
    it('finds the same aggregate on another row', () => {
      const fields = [fn(SUM_FOO), fn(SUM_FOO), fn(SUM_BAR)];

      expect(hasDuplicateAggregate(fields, 0, SUM_FOO)).toBe(true);
      expect(hasDuplicateAggregate(fields, 2, SUM_BAR)).toBe(false);
    });
  });

  describe('replaceAggregateInEquations', () => {
    it('rewrites every equation using the aggregate', () => {
      const fields = [fn(SUM_FOO), eq(`${SUM_FOO} / ${SUM_BAR}`), eq(`${SUM_FOO} * 2`)];
      const next = replaceAggregateInEquations(fields, SUM_FOO, SUM_BAZ_FILTERED);

      expect(next[0]).toBe(fields[0]);
      expect(next[1]).toEqual(eq(`${SUM_BAZ_FILTERED} / ${SUM_BAR}`));
      expect(next[2]).toEqual(eq(`${SUM_BAZ_FILTERED} * 2`));
    });

    it('returns the same fields when nothing referenced the aggregate', () => {
      const fields = [fn(SUM_FOO), eq(`${SUM_BAR} * 2`)];
      expect(replaceAggregateInEquations(fields, SUM_FOO, SUM_BAZ_FILTERED)).toBe(fields);
    });
  });
});
