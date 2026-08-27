import {WidgetType} from 'sentry/views/dashboards/types';
import {
  expandGlobalFilterFallback,
  withGlobalFilterFallback,
} from 'sentry/views/dashboards/utils/expandGlobalFilterFallback';

const SCREEN_FALLBACK = {
  attribute: 'app.vitals.start.screen',
  fallbackAttribute: 'transaction',
};

describe('expandGlobalFilterFallback', () => {
  it('ORs the filtered attribute with its fallback', () => {
    expect(
      expandGlobalFilterFallback(
        'app.vitals.start.screen:[MainActivity]',
        SCREEN_FALLBACK
      )
    ).toBe('(app.vitals.start.screen:[MainActivity] OR transaction:[MainActivity])');
  });

  it('keeps unrelated filters applied to both sides of the OR', () => {
    expect(
      expandGlobalFilterFallback(
        'os.name:Android app.vitals.start.screen:[MainActivity]',
        SCREEN_FALLBACK
      )
    ).toBe(
      'os.name:Android (app.vitals.start.screen:[MainActivity] OR transaction:[MainActivity])'
    );
  });

  it('expands every matching value', () => {
    expect(
      expandGlobalFilterFallback(
        'app.vitals.start.screen:[MainActivity,DetailActivity]',
        SCREEN_FALLBACK
      )
    ).toBe(
      '(app.vitals.start.screen:[MainActivity,DetailActivity] OR transaction:[MainActivity,DetailActivity])'
    );
  });

  it('leaves conditions without the filtered attribute unchanged', () => {
    expect(expandGlobalFilterFallback('', SCREEN_FALLBACK)).toBe('');
    expect(expandGlobalFilterFallback('os.name:Android', SCREEN_FALLBACK)).toBe(
      'os.name:Android'
    );
  });

  it('leaves conditions unchanged without a fallback', () => {
    expect(
      expandGlobalFilterFallback('app.vitals.start.screen:[MainActivity]', undefined)
    ).toBe('app.vitals.start.screen:[MainActivity]');
  });

  it('does not widen has: or negated filters', () => {
    expect(
      expandGlobalFilterFallback('has:app.vitals.start.screen', SCREEN_FALLBACK)
    ).toBe('has:app.vitals.start.screen');
    expect(
      expandGlobalFilterFallback('!app.vitals.start.screen:MainActivity', SCREEN_FALLBACK)
    ).toBe('!app.vitals.start.screen:MainActivity');
    expect(
      expandGlobalFilterFallback('!has:app.vitals.start.screen', SCREEN_FALLBACK)
    ).toBe('!has:app.vitals.start.screen');
  });

  it('leaves value + (no value) combinations unchanged', () => {
    expect(
      expandGlobalFilterFallback(
        '(app.vitals.start.screen:MainActivity OR !has:app.vitals.start.screen)',
        SCREEN_FALLBACK
      )
    ).toBe('(app.vitals.start.screen:MainActivity OR !has:app.vitals.start.screen)');
  });
});

describe('withGlobalFilterFallback', () => {
  const dashboardFilters = {
    globalFilter: [
      {
        dataset: WidgetType.SPANS,
        tag: {key: 'app.vitals.start.screen', name: 'app.vitals.start.screen'},
        value: 'app.vitals.start.screen:[MainActivity]',
      },
    ],
  };

  it('rewrites matching global filters when a fallback is set', () => {
    expect(
      withGlobalFilterFallback(dashboardFilters, SCREEN_FALLBACK)?.globalFilter?.[0]
        ?.value
    ).toBe('(app.vitals.start.screen:[MainActivity] OR transaction:[MainActivity])');
  });

  it('leaves dashboard filters unchanged without a fallback', () => {
    expect(withGlobalFilterFallback(dashboardFilters, undefined)).toEqual(
      dashboardFilters
    );
  });
});
