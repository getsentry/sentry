import {expandGlobalFilterFallbacks} from 'sentry/views/dashboards/utils/expandGlobalFilterFallbacks';

const SCREEN_FALLBACK = [
  {attribute: 'app.vitals.start.screen', fallbackAttribute: 'transaction'},
];

describe('expandGlobalFilterFallbacks', () => {
  it('ORs the filtered attribute with its fallback', () => {
    expect(
      expandGlobalFilterFallbacks(
        'app.vitals.start.screen:[MainActivity]',
        SCREEN_FALLBACK
      )
    ).toBe('(app.vitals.start.screen:[MainActivity] OR transaction:[MainActivity])');
  });

  it('keeps unrelated filters applied to both sides of the OR', () => {
    expect(
      expandGlobalFilterFallbacks(
        'os.name:Android app.vitals.start.screen:[MainActivity]',
        SCREEN_FALLBACK
      )
    ).toBe(
      'os.name:Android (app.vitals.start.screen:[MainActivity] OR transaction:[MainActivity])'
    );
  });

  it('expands every matching value', () => {
    expect(
      expandGlobalFilterFallbacks(
        'app.vitals.start.screen:[MainActivity,DetailActivity]',
        SCREEN_FALLBACK
      )
    ).toBe(
      '(app.vitals.start.screen:[MainActivity,DetailActivity] OR transaction:[MainActivity,DetailActivity])'
    );
  });

  it('leaves conditions without the filtered attribute unchanged', () => {
    expect(expandGlobalFilterFallbacks('', SCREEN_FALLBACK)).toBe('');
    expect(expandGlobalFilterFallbacks('os.name:Android', SCREEN_FALLBACK)).toBe(
      'os.name:Android'
    );
  });

  it('leaves conditions unchanged without declared fallbacks', () => {
    expect(
      expandGlobalFilterFallbacks('app.vitals.start.screen:[MainActivity]', undefined)
    ).toBe('app.vitals.start.screen:[MainActivity]');
    expect(
      expandGlobalFilterFallbacks('app.vitals.start.screen:[MainActivity]', [])
    ).toBe('app.vitals.start.screen:[MainActivity]');
  });

  it('does not widen has: or negated filters', () => {
    expect(
      expandGlobalFilterFallbacks('has:app.vitals.start.screen', SCREEN_FALLBACK)
    ).toBe('has:app.vitals.start.screen');
    expect(
      expandGlobalFilterFallbacks(
        '!app.vitals.start.screen:MainActivity',
        SCREEN_FALLBACK
      )
    ).toBe('!app.vitals.start.screen:MainActivity');
    expect(
      expandGlobalFilterFallbacks('!has:app.vitals.start.screen', SCREEN_FALLBACK)
    ).toBe('!has:app.vitals.start.screen');
  });
});
