import {getCurrentView, getQuery} from 'app/views/organizationEventsV2/utils';
import {ALL_VIEWS} from 'app/views/organizationEventsV2/data';

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
        fields: ['event', 'user', 'issue.id'],
      },
      tags: [],
    };

    expect(getQuery(view, {}).field).toEqual([
      'title',
      'id',
      'project.name',
      'user',
      'user.name',
      'user.email',
      'user.ip',
      'issue.id',
    ]);
  });

  it('handles grouping by issue', function() {
    const view = {
      id: 'test',
      name: 'test view',
      data: {
        fields: ['error', 'project'],
        sort: 'project.id',
      },
      tags: [],
    };

    const query = getQuery(view, {});

    expect(query).toEqual({
      aggregation: [['anyHeavy', 'title', 'issue_group']],
      field: ['project.name'],
      groupby: ['issue.id', 'project.id'],
      sort: 'project.id',
    });
  });
});
