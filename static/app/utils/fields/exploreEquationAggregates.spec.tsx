import {
  ALLOWED_EXPLORE_EQUATION_AGGREGATES,
  ALLOWED_EXPLORE_EQUATION_CONDITIONAL_AGGREGATES,
  AggregationKey,
  EXPLORE_FILTERABLE_AGGREGATES,
  getExploreEquationAggregates,
  getExploreEquationFieldDefinition,
  getFieldDefinition,
} from 'sentry/utils/fields';

describe('Explore equation conditional aggregates', () => {
  it('keeps Discover avg_if and count_if on the ungated equation list', () => {
    expect(ALLOWED_EXPLORE_EQUATION_AGGREGATES).toContain(AggregationKey.AVG_IF);
    expect(ALLOWED_EXPLORE_EQUATION_AGGREGATES).toContain(AggregationKey.COUNT_IF);
    expect(getExploreEquationAggregates(false)).toEqual(
      ALLOWED_EXPLORE_EQUATION_AGGREGATES
    );
  });

  it('offers EAP _if aggregates only when the feature is on', () => {
    expect(ALLOWED_EXPLORE_EQUATION_CONDITIONAL_AGGREGATES).toEqual(
      EXPLORE_FILTERABLE_AGGREGATES.map(name => `${name}_if`)
    );
    expect(getExploreEquationAggregates(true)).toEqual(
      expect.arrayContaining(ALLOWED_EXPLORE_EQUATION_CONDITIONAL_AGGREGATES)
    );
    for (const name of ALLOWED_EXPLORE_EQUATION_CONDITIONAL_AGGREGATES) {
      if (name === 'avg_if' || name === 'count_if') {
        continue;
      }
      expect(getExploreEquationAggregates(false)).not.toContain(name);
    }
  });

  it('uses EAP filter-first avg_if when gated on', () => {
    const ungated = getFieldDefinition('avg_if', 'span');
    expect(ungated?.parameters?.map(parameter => parameter.name)).toEqual([
      'column',
      'condition_column',
      'condition',
      'value',
    ]);

    const definition = getExploreEquationFieldDefinition('avg_if', undefined, true);
    expect(definition?.parameters?.map(parameter => parameter.name)).toEqual([
      'filter',
      'column',
    ]);
    expect(definition?.parameters?.[0]).toMatchObject({
      kind: 'value',
      defaultValue: '``',
    });
    expect(definition?.parameters?.[1]).toMatchObject({
      kind: 'column',
      defaultValue: 'span.duration',
    });
  });

  it('keeps Discover avg_if when existing args are not backtick filters', () => {
    const definition = getExploreEquationFieldDefinition('avg_if', undefined, true, [
      'span.duration',
      'span.op',
      'equals',
      'db',
    ]);
    expect(definition?.parameters?.map(parameter => parameter.name)).toEqual([
      'column',
      'condition_column',
      'condition',
      'value',
    ]);
  });

  it('keeps EAP filter-first params for EAP-only _if without backticks', () => {
    expect(getFieldDefinition('sum_if', 'span')).toBeNull();

    const definition = getExploreEquationFieldDefinition('sum_if', undefined, true, [
      'span.duration',
    ]);
    expect(definition?.parameters?.map(parameter => parameter.name)).toEqual([
      'filter',
      'column',
    ]);
  });

  it('keeps Discover count_if unless the feature is on', () => {
    const ungated = getFieldDefinition('count_if', 'span');
    expect(ungated?.parameters?.map(parameter => parameter.name)).toEqual([
      'column',
      'value',
      'value',
    ]);
    expect(ungated?.parameters?.some(parameter => 'options' in parameter)).toBe(true);

    const gated = getExploreEquationFieldDefinition('count_if', undefined, true);
    expect(gated?.parameters?.map(parameter => parameter.name)).toEqual([
      'filter',
      'column',
    ]);
    expect(gated?.parameters?.[0]).toMatchObject({
      kind: 'value',
      defaultValue: '``',
    });
    expect(gated?.parameters?.some(parameter => 'options' in parameter)).toBe(false);
  });

  it('does not use Discover-style condition operators on gated equation _if aggregates', () => {
    for (const name of ALLOWED_EXPLORE_EQUATION_CONDITIONAL_AGGREGATES) {
      const definition = getExploreEquationFieldDefinition(name, undefined, true);
      expect(definition?.parameters?.[0]).toMatchObject({
        name: 'filter',
        kind: 'value',
        defaultValue: '``',
      });
      expect(
        definition?.parameters?.some(
          parameter => 'options' in parameter && Boolean(parameter.options?.length)
        )
      ).toBe(false);
    }
  });
});
