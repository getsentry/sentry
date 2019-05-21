import {ALL_VIEWS, getCurrentView, getQuery} from 'app/views/organizationEventsV2/utils';

describe('getCurrentView()', function() {
  it('returns current view', function() {
    expect(getCurrentView('all')).toBe(ALL_VIEWS[0]);
    expect(getCurrentView('errors')).toBe(ALL_VIEWS[1]);
    expect(getCurrentView('csp')).toBe(ALL_VIEWS[2]);
  });

  it('returns default if invalid', function() {
    expect(getCurrentView(undefined)).toBe(ALL_VIEWS[0]);
    expect(getCurrentView('blah')).toBe(ALL_VIEWS[0]);
  });
});

describe('getQuery()', function() {
  it('expands special "event" and "user" fields', function() {
    const view = {
      id: 'test',
      name: 'test view',
      data: {
        query: '',
        fields: ['event', 'user', 'issue.id'],
      },
      tags: [],
    };

    expect(getQuery(view).fields).toEqual([
      'id',
      'title',
      'user.email',
      'user.ip',
      'issue.id',
    ]);
  });
});
