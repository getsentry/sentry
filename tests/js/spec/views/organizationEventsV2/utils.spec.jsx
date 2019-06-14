import {
  getCurrentView,
  getQuery,
  getEventTagSearchUrl,
} from 'app/views/organizationEventsV2/utils';
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

  it('appends any additional conditions defined for view', function() {
    const view = {
      id: 'test',
      name: 'test view',
      data: {fields: ['id'], query: 'event.type:csp'},
      tags: [],
    };

    expect(getQuery(view, {}).query).toEqual('event.type:csp');
    expect(getQuery(view, {query: {query: 'test'}}).query).toEqual('test event.type:csp');
  });
});

describe('eventTagSearchUrl()', function() {
  let location;
  beforeEach(function() {
    location = {
      pathname: '/organization/org-slug/events/',
      query: {},
    };
  });

  it('adds a query', function() {
    expect(getEventTagSearchUrl('browser', 'firefox', location)).toEqual({
      pathname: location.pathname,
      query: {query: 'browser:"firefox"'},
    });
  });

  it('removes eventSlug', function() {
    location.query.eventSlug = 'project-slug:deadbeef';
    expect(getEventTagSearchUrl('browser', 'firefox', location)).toEqual({
      pathname: location.pathname,
      query: {query: 'browser:"firefox"'},
    });
  });

  it('appends to an existing query', function() {
    location.query.query = 'failure';
    expect(getEventTagSearchUrl('browser', 'firefox', location)).toEqual({
      pathname: location.pathname,
      query: {query: 'failure browser:"firefox"'},
    });
  });
});
