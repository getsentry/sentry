import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ThemeFixture} from 'sentry-fixture/theme';
import {UserFixture} from 'sentry-fixture/user';
import {WidgetFixture} from 'sentry-fixture/widget';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
  Organization,
} from 'sentry/types/organization';
import type {EventViewOptions} from 'sentry/utils/discover/eventView';
import {EventView} from 'sentry/utils/discover/eventView';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';
import {SpansConfig} from 'sentry/views/dashboards/datasetConfig/spans';
import {DisplayType, type WidgetQuery} from 'sentry/views/dashboards/types';

const theme = ThemeFixture();

describe('SpansConfig', () => {
  let organization: Organization;

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

  it('renders internal error count as a link to explore with error filter', () => {
    const field = 'count_if(span.status,equals,internal_error)';
    const location = LocationFixture();

    const baseEventViewOptions: EventViewOptions = {
      start: undefined,
      end: undefined,
      createdBy: UserFixture(),
      display: undefined,
      fields: [],
      sorts: [],
      query: '',
      project: [1],
      environment: [],
      yAxis: 'count()',
      id: undefined,
      name: undefined,
      statsPeriod: '14d',
      team: [],
      topEvents: undefined,
    };

    const widget = WidgetFixture({
      displayType: DisplayType.TABLE,
      queries: [
        {
          name: '',
          fields: ['gen_ai.tool.name', field],
          columns: ['gen_ai.tool.name'],
          fieldAliases: [],
          aggregates: [field],
          conditions: 'gen_ai.operation.type:tool',
          orderby: `-${field}`,
        },
      ],
    });

    const org = OrganizationFixture({features: ['performance-view']});
    const renderer = SpansConfig.getCustomFieldRenderer!(
      field,
      {},
      widget,
      org,
      undefined
    );
    render(
      renderer(
        {[field]: 5, 'gen_ai.tool.name': 'Web Search'},
        {
          organization: org,
          location,
          theme,
          eventView: new EventView({
            ...baseEventViewOptions,
            fields: [{field}],
          }),
        }
      ) as React.ReactElement<any, any>
    );

    const link = screen.getByRole('link', {name: '5'});
    expect(link).toBeInTheDocument();

    const href = link.getAttribute('href')!;
    expect(href).toContain('gen_ai.tool.name%3A%22Web%20Search%22');
    expect(href).toContain('gen_ai.operation.type%3Atool');
    expect(href).toContain('span.status%3Ainternal_error');
  });
});
