import {WidgetType} from 'sentry/views/dashboards/types';
import {withGlobalFilterFallback} from 'sentry/views/dashboards/utils/withGlobalFilterFallback';

const SCREEN_FALLBACK = {
  attribute: 'app.vitals.start.screen',
  fallbackAttribute: 'transaction',
};

function filtersFor(value: string, key = 'app.vitals.start.screen') {
  return {
    globalFilter: [
      {
        dataset: WidgetType.SPANS,
        tag: {key, name: key},
        value,
      },
    ],
  };
}

function expand(value: string, key?: string) {
  return withGlobalFilterFallback(filtersFor(value, key), SCREEN_FALLBACK)
    ?.globalFilter?.[0]?.value;
}

describe('withGlobalFilterFallback', () => {
  it('ORs the filtered attribute with its fallback', () => {
    expect(expand('app.vitals.start.screen:[MainActivity]')).toBe(
      '(app.vitals.start.screen:[MainActivity] OR transaction:[MainActivity])'
    );
  });

  it('expands every matching value', () => {
    expect(expand('app.vitals.start.screen:[MainActivity,DetailActivity]')).toBe(
      '(app.vitals.start.screen:[MainActivity,DetailActivity] OR transaction:[MainActivity,DetailActivity])'
    );
  });

  it('preserves quoting, wildcards, and operators', () => {
    expect(expand('app.vitals.start.screen:["My Screen"]')).toBe(
      '(app.vitals.start.screen:["My Screen"] OR transaction:["My Screen"])'
    );
    expect(expand('app.vitals.start.screen:*Activity')).toBe(
      '(app.vitals.start.screen:*Activity OR transaction:*Activity)'
    );
  });

  it('leaves global filters on other attributes unchanged', () => {
    expect(expand('os.name:[Android]', 'os.name')).toBe('os.name:[Android]');
  });

  // The clause is rebuilt by slicing off `filterToken.key.text`, which includes any
  // bracket or type syntax, so explicit tag keys survive the swap.
  it('handles explicit tag keys', () => {
    expect(
      withGlobalFilterFallback(
        filtersFor('tags[custom_tag]:[foo,bar]', 'tags[custom_tag]'),
        {
          attribute: 'tags[custom_tag]',
          fallbackAttribute: 'transaction',
        }
      )?.globalFilter?.[0]?.value
    ).toBe('(tags[custom_tag]:[foo,bar] OR transaction:[foo,bar])');
  });

  it('does not widen negated or has: filters', () => {
    expect(expand('!app.vitals.start.screen:[MainActivity]')).toBe(
      '!app.vitals.start.screen:[MainActivity]'
    );
    expect(expand('has:app.vitals.start.screen')).toBe('has:app.vitals.start.screen');
    expect(expand('!has:app.vitals.start.screen')).toBe('!has:app.vitals.start.screen');
  });

  it('leaves value + (no value) combinations unchanged', () => {
    expect(
      expand('(app.vitals.start.screen:MainActivity OR !has:app.vitals.start.screen)')
    ).toBe('(app.vitals.start.screen:MainActivity OR !has:app.vitals.start.screen)');
    expect(
      expand('(!app.vitals.start.screen:MainActivity AND has:app.vitals.start.screen)')
    ).toBe('(!app.vitals.start.screen:MainActivity AND has:app.vitals.start.screen)');
  });

  // Every dashboard except the two prebuilt App Starts tables leaves
  // `globalFilterFallback` unset, so that path must return the exact same object.
  it('returns dashboard filters untouched without a fallback', () => {
    const dashboardFilters = filtersFor('app.vitals.start.screen:[MainActivity]');
    expect(withGlobalFilterFallback(dashboardFilters, undefined)).toBe(dashboardFilters);
  });

  it('returns dashboard filters untouched when there are no global filters', () => {
    const dashboardFilters = {release: ['1.0.0']};
    expect(withGlobalFilterFallback(dashboardFilters, SCREEN_FALLBACK)).toBe(
      dashboardFilters
    );
  });

  it('passes through undefined dashboard filters', () => {
    expect(withGlobalFilterFallback(undefined, SCREEN_FALLBACK)).toBeUndefined();
  });
});
