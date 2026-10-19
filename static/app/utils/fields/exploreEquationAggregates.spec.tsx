import {
  ALLOWED_EXPLORE_EQUATION_AGGREGATES,
  ALLOWED_EXPLORE_EQUATION_CONDITIONAL_AGGREGATES,
  EXPLORE_FILTERABLE_AGGREGATES,
  getExploreEquationFieldDefinition,
  getFieldDefinition,
} from 'sentry/utils/fields';

describe('Explore equation conditional aggregates', () => {
  it('offers EAP _if aggregates in the equation builder', () => {
    expect(ALLOWED_EXPLORE_EQUATION_CONDITIONAL_AGGREGATES).toEqual(
      EXPLORE_FILTERABLE_AGGREGATES.map(name => `${name}_if`)
    );
    expect(ALLOWED_EXPLORE_EQUATION_AGGREGATES).toEqual(
      expect.arrayContaining(ALLOWED_EXPLORE_EQUATION_CONDITIONAL_AGGREGATES)
    );
  });

  it('uses EAP filter-first avg_if', () => {
    const ungated = getFieldDefinition('avg_if', 'span');
    expect(ungated?.parameters?.map(parameter => parameter.name)).toEqual([
      'column',
      'condition_column',
      'condition',
      'value',
    ]);

    const definition = getExploreEquationFieldDefinition('avg_if');
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
    const definition = getExploreEquationFieldDefinition('avg_if', undefined, [
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

    const definition = getExploreEquationFieldDefinition('sum_if', undefined, [
      'span.duration',
    ]);
    expect(definition?.parameters?.map(parameter => parameter.name)).toEqual([
      'filter',
      'column',
    ]);
  });

  it('uses EAP filter-first count_if', () => {
    const ungated = getFieldDefinition('count_if', 'span');
    expect(ungated?.parameters?.map(parameter => parameter.name)).toEqual([
      'column',
      'value',
      'value',
    ]);
    expect(ungated?.parameters?.some(parameter => 'options' in parameter)).toBe(true);

    const definition = getExploreEquationFieldDefinition('count_if');
    expect(definition?.parameters?.map(parameter => parameter.name)).toEqual([
      'filter',
      'column',
    ]);
    expect(definition?.parameters?.[0]).toMatchObject({
      kind: 'value',
      defaultValue: '``',
    });
    expect(definition?.parameters?.some(parameter => 'options' in parameter)).toBe(false);
  });

  it('does not use Discover-style condition operators on equation _if aggregates', () => {
    for (const name of ALLOWED_EXPLORE_EQUATION_CONDITIONAL_AGGREGATES) {
      const definition = getExploreEquationFieldDefinition(name);
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
