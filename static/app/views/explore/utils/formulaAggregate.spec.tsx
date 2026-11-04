import type {SavedFormula} from 'sentry/views/explore/hooks/useGetSavedFormulas';
import {
  buildFormulaYAxis,
  getFormulaColumnFunction,
} from 'sentry/views/explore/utils/formulaAggregate';

const APDEX: SavedFormula = {
  id: '1',
  name: 'formula.apdex',
  dataset: 'spans',
  description: null,
  formula: '{count_satisfied} / count()',
  prebuilt: true,
  type: 'number',
  unit: null,
  references: [],
  createdBy: null,
  updatedBy: null,
  params: [
    {name: 'threshold', type: 'number', order: 1, value: ''},
    {name: 'duration', type: 'column', order: 0, value: ''},
    {name: 'frustrated', type: 'calculation', order: 2, value: '{threshold} * 4'},
  ],
};

describe('buildFormulaYAxis', () => {
  it('fills arguments in param order and skips calculations', () => {
    expect(buildFormulaYAxis(APDEX, 'span.duration')).toBe(
      'formula.apdex(span.duration,1)'
    );
  });

  it('returns null when a column is needed but there is no default', () => {
    expect(buildFormulaYAxis(APDEX, null)).toBeNull();
  });

  it('prefers suggested values over the defaults', () => {
    const params = APDEX.params.map(param =>
      param.type === 'calculation'
        ? param
        : {...param, value: param.type === 'number' ? '300' : 'span.self_time'}
    );
    expect(buildFormulaYAxis({...APDEX, params}, null)).toBe(
      'formula.apdex(span.self_time,300)'
    );
  });

  it('does not need a default column when there are no column params', () => {
    expect(
      buildFormulaYAxis(
        {...APDEX, params: APDEX.params.filter(param => param.type !== 'column')},
        null
      )
    ).toBe('formula.apdex(1)');
  });
});

describe('getFormulaColumnFunction', () => {
  it('only keeps column arguments', () => {
    expect(
      getFormulaColumnFunction(APDEX, {
        name: 'formula.apdex',
        arguments: ['span.self_time', '300'],
      })
    ).toEqual({name: 'formula.apdex', arguments: ['span.self_time']});
  });
});
