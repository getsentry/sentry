import {
  COLD_START_TABLE_OPERATIONS_CONDITION,
  expandAppStartScreenFilter,
  isAppStartOperationsQuery,
  WARM_START_TABLE_OPERATIONS_CONDITION,
} from 'sentry/views/dashboards/utils/prebuiltConfigs/mobileVitals/constants';

describe('isAppStartOperationsQuery', () => {
  it('matches the cold and warm operations tables', () => {
    expect(isAppStartOperationsQuery(COLD_START_TABLE_OPERATIONS_CONDITION)).toBe(true);
    expect(isAppStartOperationsQuery(WARM_START_TABLE_OPERATIONS_CONDITION)).toBe(true);
  });

  it('does not match other queries', () => {
    expect(isAppStartOperationsQuery(undefined)).toBe(false);
    expect(isAppStartOperationsQuery('')).toBe(false);
    expect(isAppStartOperationsQuery('has:app.vitals.start.screen')).toBe(false);
  });
});

describe('expandAppStartScreenFilter', () => {
  it('ORs a screen filter with child spans of the same transaction', () => {
    expect(expandAppStartScreenFilter('app.vitals.start.screen:[MainActivity]')).toBe(
      '(app.vitals.start.screen:[MainActivity] OR (transaction:[MainActivity] !is_transaction:true))'
    );
  });

  it('keeps other filters in the expanded branch', () => {
    expect(
      expandAppStartScreenFilter('os.name:Android app.vitals.start.screen:[MainActivity]')
    ).toBe(
      '(os.name:Android app.vitals.start.screen:[MainActivity] OR (transaction:[MainActivity] !is_transaction:true))'
    );
  });

  it('leaves filters without a screen value unchanged', () => {
    expect(expandAppStartScreenFilter('')).toBe('');
    expect(expandAppStartScreenFilter('os.name:Android')).toBe('os.name:Android');
  });

  it('does not rewrite has: or negated screen filters', () => {
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
});
