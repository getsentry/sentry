import {WidgetFixture} from 'sentry-fixture/widget';

import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {
  COLD_OPERATIONS_TABLE_WIDGET_ID,
  expandAppStartScreenFilter,
  withAppStartScreenFilterFallback,
  widenAppStartScreenFilter,
} from 'sentry/views/dashboards/utils/prebuiltConfigs/mobileVitals/widenAppStartScreenFilter';

describe('expandAppStartScreenFilter', () => {
  it('ORs the screen filter with transaction', () => {
    expect(expandAppStartScreenFilter('app.vitals.start.screen:[MainActivity]')).toBe(
      '(app.vitals.start.screen:[MainActivity] OR transaction:[MainActivity])'
    );
  });

  it('keeps unrelated filters applied to both sides of the OR', () => {
    expect(
      expandAppStartScreenFilter('os.name:Android app.vitals.start.screen:[MainActivity]')
    ).toBe(
      'os.name:Android (app.vitals.start.screen:[MainActivity] OR transaction:[MainActivity])'
    );
  });

  it('expands every matching value', () => {
    expect(
      expandAppStartScreenFilter('app.vitals.start.screen:[MainActivity,DetailActivity]')
    ).toBe(
      '(app.vitals.start.screen:[MainActivity,DetailActivity] OR transaction:[MainActivity,DetailActivity])'
    );
  });

  it('leaves conditions without the screen filter unchanged', () => {
    expect(expandAppStartScreenFilter('')).toBe('');
    expect(expandAppStartScreenFilter('os.name:Android')).toBe('os.name:Android');
  });

  it('does not widen has: or negated filters', () => {
    expect(expandAppStartScreenFilter('has:app.vitals.start.screen')).toBe(
      'has:app.vitals.start.screen'
    );
    expect(expandAppStartScreenFilter('!app.vitals.start.screen:MainActivity')).toBe(
      '!app.vitals.start.screen:MainActivity'
    );
    expect(expandAppStartScreenFilter('!has:app.vitals.start.screen')).toBe(
      '!has:app.vitals.start.screen'
    );
  });

  it('leaves value + (no value) combinations unchanged', () => {
    expect(
      expandAppStartScreenFilter(
        '(app.vitals.start.screen:MainActivity OR !has:app.vitals.start.screen)'
      )
    ).toBe('(app.vitals.start.screen:MainActivity OR !has:app.vitals.start.screen)');
  });
});

describe('widenAppStartScreenFilter', () => {
  it('widens only App Starts operations widgets', () => {
    const operationsWidget = WidgetFixture({id: COLD_OPERATIONS_TABLE_WIDGET_ID});
    const otherWidget = WidgetFixture({id: 'some-other-widget'});
    const filters = 'app.vitals.start.screen:[MainActivity]';

    expect(widenAppStartScreenFilter(operationsWidget, filters)).toBe(
      '(app.vitals.start.screen:[MainActivity] OR transaction:[MainActivity])'
    );
    expect(widenAppStartScreenFilter(otherWidget, filters)).toBe(filters);
  });
});

describe('withAppStartScreenFilterFallback', () => {
  it('rewrites screen global filters for operations widgets only', () => {
    const dashboardFilters = {
      globalFilter: [
        {
          dataset: WidgetType.SPANS,
          tag: {key: 'app.vitals.start.screen', name: 'app.vitals.start.screen'},
          value: 'app.vitals.start.screen:[MainActivity]',
        },
      ],
    };

    expect(
      withAppStartScreenFilterFallback(
        WidgetFixture({
          id: COLD_OPERATIONS_TABLE_WIDGET_ID,
          displayType: DisplayType.TABLE,
        }),
        dashboardFilters
      )?.globalFilter?.[0]?.value
    ).toBe('(app.vitals.start.screen:[MainActivity] OR transaction:[MainActivity])');

    expect(
      withAppStartScreenFilterFallback(
        WidgetFixture({id: 'avg-cold-starts', displayType: DisplayType.BIG_NUMBER}),
        dashboardFilters
      )
    ).toEqual(dashboardFilters);
  });
});
