import {
  getCurrentView,
  getQuery,
  getQueryString,
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
  it('appends any additional conditions defined for view', function() {
    const view = {
      id: 'test',
      name: 'test view',
      data: {fields: ['id'], query: 'event.type:csp'},
      tags: [],
    };

    expect(getQuery(view, {}).query).toEqual('event.type:csp');
  });

  it('appends query conditions in location', function() {
    const view = {
      id: 'test',
      name: 'test view',
      data: {fields: ['id'], query: 'event.type:csp'},
      tags: [],
    };
    const location = {
      query: {
        query: 'TypeError',
      },
    };
    expect(getQuery(view, location).query).toEqual('event.type:csp TypeError');
  });
});

describe('getQueryString()', function() {
  it('excludes empty values', function() {
    const view = {
      data: {
        query: 'event.type:transaction',
      },
    };
    const location = {
      query: {query: ''},
    };
    expect(getQueryString(view, location)).toEqual('event.type:transaction');
  });

  it('includes view, and location query data', function() {
    const view = {
      data: {
        query: 'event.type:transaction',
      },
    };
    const location = {
      query: {query: 'TypeError'},
    };
    expect(getQueryString(view, location)).toEqual('event.type:transaction TypeError');
  });

  it('includes non-empty additional data', function() {
    const view = {
      data: {
        query: 'event.type:transaction',
      },
    };
    const location = {};
    const additional = {
      nope: '',
      undef: undefined,
      nullish: null,
      yes: 'value',
    };
    expect(getQueryString(view, location, additional)).toEqual(
      'event.type:transaction yes:value'
    );
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
