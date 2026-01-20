import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {WidgetFixture} from 'sentry-fixture/widget';

import {waitFor} from 'sentry-test/reactTestingLibrary';

import type {Client} from 'sentry/api';
import type {
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
  Organization,
} from 'sentry/types/organization';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';
import {SpansConfig} from 'sentry/views/dashboards/datasetConfig/spans';
import {WidgetType, type WidgetQuery} from 'sentry/views/dashboards/types';

describe('SpansConfig', () => {
  let organization: Organization;
  const api: Client = new MockApiClient();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    organization = OrganizationFixture({
      features: ['performance-view'],
    });
  });

  it('returns all of the EAP aggregations as primary options', () => {
    const functionOptions = Object.keys(
      SpansConfig.getTableFieldOptions(organization, {})
    )
      .filter(func => func.startsWith('function'))
      .map(func => func.split(':')[1]);

    expect(functionOptions).toEqual(ALLOWED_EXPLORE_VISUALIZE_AGGREGATES);
  });

  it('can make a series request with the expected dataset', async () => {
    const eventsStatsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: [],
    });

    const widget = WidgetFixture({
      widgetType: WidgetType.SPANS,
    });

    // Trigger request
    SpansConfig.getSeriesRequest!(
      api,
      widget,
      0,
      organization,
      PageFiltersFixture(),
      undefined,
      'test-referrer',
      undefined
    );

    expect(eventsStatsMock).toHaveBeenCalled();
    await waitFor(() => {
      expect(eventsStatsMock).toHaveBeenCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({dataset: DiscoverDatasets.SPANS}),
        })
      );
    });
  });

  it('surfaces types and units correctly for multi-series (grouped) responses with a single aggregate', () => {
    // Meta is copied for all series in the response
    const commonMockedMeta: EventsStats['meta'] = {
      units: {'count(span.duration)': 'millisecond'},
      fields: {'count(span.duration)': 'integer'},
      isMetricsData: false,
      tips: {},
    };
    // Multi-series response with multiple grouped series
    const multiSeriesData: MultiSeriesEventsStats = {
      'GET /api/users': {
        order: 0,
        data: [[1234567890, [{count: 100}]]],
        meta: commonMockedMeta,
      },
      'POST /api/data': {
        order: 1,
        data: [[1234567890, [{count: 250}]]],
        meta: commonMockedMeta,
      },
    };

    const widgetQuery: WidgetQuery = {
      name: '',
      fields: [],
      columns: ['transaction'], // Grouped by transaction
      fieldAliases: [],
      aggregates: ['count(span.duration)'],
      conditions: '',
      orderby: '-count(span.duration)',
    };

    const resultTypes = SpansConfig.getSeriesResultType!(multiSeriesData, widgetQuery);
    expect(resultTypes['GET /api/users']).toBe('integer');
    expect(resultTypes['POST /api/data']).toBe('integer');

    const resultUnits = SpansConfig.getSeriesResultUnit!(multiSeriesData, widgetQuery);
    expect(resultUnits['GET /api/users']).toBe('millisecond');
    expect(resultUnits['POST /api/data']).toBe('millisecond');
  });

  it('surfaces types and units correctly for multi-series (grouped) responses with a multiple aggregates', () => {
    // Meta is copied for all series in the response
    const commonMockedMeta: EventsStats['meta'] = {
      units: {'count(span.duration)': null, 'p50(span.duration)': 'millisecond'},
      fields: {'count(span.duration)': 'integer', 'p50(span.duration)': 'duration'},
      isMetricsData: false,
      tips: {},
    };
    // Multi-series response with multiple aggregates and grouped series
    const multiSeriesData: GroupedMultiSeriesEventsStats = {
      'GET /api/users': {
        order: 0,
        'count(span.duration)': {
          data: [[1234567890, [{count: 100}]]],
          meta: commonMockedMeta,
        },
        'p50(span.duration)': {
          data: [[1234567890, [{count: 100}]]],
          meta: commonMockedMeta,
        },
      },
      'POST /api/data': {
        order: 1,
        'count(span.duration)': {
          data: [[1234567890, [{count: 250}]]],
          meta: commonMockedMeta,
        },
        'p50(span.duration)': {
          data: [[1234567890, [{count: 100}]]],
          meta: commonMockedMeta,
        },
      },
    };

    const widgetQuery: WidgetQuery = {
      name: '',
      fields: [],
      columns: ['transaction'], // Grouped by transaction
      fieldAliases: [],
      aggregates: ['count(span.duration)', 'p50(span.duration)'],
      conditions: '',
      orderby: '-count(span.duration)',
    };

    const resultTypes = SpansConfig.getSeriesResultType!(multiSeriesData, widgetQuery);
    expect(resultTypes['count(span.duration)']).toBe('integer');
    expect(resultTypes['p50(span.duration)']).toBe('duration');

    const resultUnits = SpansConfig.getSeriesResultUnit!(multiSeriesData, widgetQuery);
    expect(resultUnits['count(span.duration)']).toBeNull();
    expect(resultUnits['p50(span.duration)']).toBe('millisecond');
  });
});
