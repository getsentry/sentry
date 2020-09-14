import {getEventsUrlFromDiscoverQueryWithConditions} from 'app/views/dashboards/utils/getEventsUrlFromDiscoverQueryWithConditions';

describe('getEventsUrlFromDiscoverQueryWithConditions', function() {
  const organization = TestStubs.Organization();

  it('single field', function() {
    const query = {
      fields: ['browser.name'],
      conditions: [],
      aggregations: ['count()', null, 'count'],
      limit: 1000,
      orderby: 'count',
    };
    expect(
      getEventsUrlFromDiscoverQueryWithConditions({
        organization,
        selection: {
          datetime: {
            start: null,
            end: null,
            period: '14d',
          },
        },
        query,
        values: ['Chrome'],
      })
    ).toBe(
      '/organizations/org-slug/events/?query=browser.name%3A%22Chrome%22&statsPeriod=14d'
    );
  });

  it('multiple fields', function() {
    const query = {
      fields: ['browser.name', 'device'],
      conditions: [],
      aggregations: ['count()', null, 'count'],
      limit: 1000,
      orderby: 'count',
    };
    expect(
      getEventsUrlFromDiscoverQueryWithConditions({
        organization,
        selection: {
          datetime: {
            start: null,
            end: null,
            period: '14d',
          },
        },
        query,
        values: ['Chrome', 'iPhone'],
      })
    ).toBe(
      '/organizations/org-slug/events/?query=browser.name%3A%22Chrome%22%20device%3A%22iPhone%22&statsPeriod=14d'
    );
  });

  it('handles null values and spaces', function() {
    const query = {
      fields: ['browser.name', 'device'],
      conditions: [],
      aggregations: ['count()', null, 'count'],
      limit: 1000,
      orderby: 'count',
    };
    expect(
      getEventsUrlFromDiscoverQueryWithConditions({
        organization,
        selection: {
          datetime: {
            start: null,
            end: null,
            period: '14d',
          },
        },
        query,
        values: [null, 'iPhone X'],
      })
    ).toBe(
      '/organizations/org-slug/events/?query=browser.name%3A%22%22%20device%3A%22iPhone%20X%22&statsPeriod=14d'
    );
  });
});
