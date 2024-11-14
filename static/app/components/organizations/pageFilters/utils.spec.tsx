import {isSelectionEqual} from 'sentry/components/organizations/pageFilters/utils';

describe('isSelectionEqual', function () {
  const base = {
    projects: [1, 2],
    environments: ['prod'],
    datetime: {
      period: '14d',
      start: new Date(2021, 0, 28, 12, 13, 14),
      end: new Date(2021, 0, 28, 23, 59, 59),
      utc: null,
    },
  };

  it('compares projects', function () {
    let changed = {...base, projects: [1]};
    expect(isSelectionEqual(base, changed)).toBe(false);

    changed = {...base, projects: []};
    expect(isSelectionEqual(base, changed)).toBe(false);

    changed = {...base, projects: [2, 3, 4]};
    expect(isSelectionEqual(base, changed)).toBe(false);
  });

  it('compares environments', function () {
    let changed = {...base, environments: ['staging']};
    expect(isSelectionEqual(base, changed)).toBe(false);

    changed = {...base, projects: []};
    expect(isSelectionEqual(base, changed)).toBe(false);

    changed = {...base, projects: [1]};
    expect(isSelectionEqual(base, changed)).toBe(false);
  });

  it('compares period', function () {
    const changed = {...base};
    changed.datetime.period = '7d';
    expect(isSelectionEqual(base, changed)).toBe(true);
  });

  it('compares start/end safely', function () {
    // Same datetime but different object.
    const changed = {
      ...base,
      datetime: {...base.datetime, start: null, end: null},
    };
    expect(isSelectionEqual(base, changed)).toBe(false);
  });

  it('compares start/end as value', function () {
    // Same datetime but different object.
    let changed = {
      ...base,
      datetime: {...base.datetime, start: new Date(2021, 0, 28, 12, 13, 14)},
    };
    expect(isSelectionEqual(base, changed)).toBe(true);

    changed = {
      ...base,
      datetime: {...base.datetime, end: new Date(2021, 0, 28, 23, 59, 59)},
    };
    expect(isSelectionEqual(base, changed)).toBe(true);

    changed = {
      ...base,
      datetime: {...base.datetime, end: new Date(2021, 0, 28, 1, 1, 1)},
    };
    expect(isSelectionEqual(base, changed)).toBe(false);

    changed = {
      ...base,
      datetime: {...base.datetime, start: new Date(2021, 0, 28, 1, 1, 1)},
    };
    expect(isSelectionEqual(base, changed)).toBe(false);
  });
});
