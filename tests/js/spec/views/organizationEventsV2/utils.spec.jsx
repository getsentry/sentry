import {getQuery, getEventTagSearchUrl} from 'app/views/organizationEventsV2/utils';
import EventView from 'app/views/organizationEventsV2/eventView';

describe('getQuery()', function() {
  it('appends any additional conditions defined for view', function() {
    const eventView = new EventView({
      fields: ['id'],
      sorts: [],
      tags: [],
      query: 'event.type:csp',
    });

    expect(getQuery(eventView, {}).query).toEqual('event.type:csp');
  });

  it('appends query conditions in location', function() {
    const eventView = new EventView({
      fields: ['id'],
      sorts: [],
      tags: [],
      query: 'event.type:csp',
    });

    const location = {
      query: {
        query: 'TypeError',
      },
    };
    expect(getQuery(eventView, location).query).toEqual('event.type:csp TypeError');
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
