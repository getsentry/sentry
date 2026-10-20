import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';
import {WidgetFixture} from 'sentry-fixture/widget';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';

import {LogsWidgetQueries} from './logsWidgetQueries';

describe('logsWidgetQueries', () => {
  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('calculates confidence and sampling metadata from timeseries', async () => {
    const selection = PageFiltersFixture();
    const widget = WidgetFixture({
      widgetType: WidgetType.LOGS,
      displayType: DisplayType.LINE,
      queries: [
        {
          name: '',
          aggregates: ['count(message)'],
          fields: ['count(message)'],
          columns: [],
          conditions: '',
          orderby: '',
        },
      ],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {
        data: [
          [1, [{count: 10}]],
          [2, [{count: 20}]],
        ],
        meta: {
          dataScanned: 'partial',
          fields: {'count(message)': 'integer'},
          units: {'count(message)': null},
          accuracy: {
            confidence: [
              {timestamp: 1, value: 'low'},
              {timestamp: 2, value: 'low'},
            ],
            sampleCount: [
              {timestamp: 1, value: 10},
              {timestamp: 2, value: 20},
            ],
            samplingRate: [
              {timestamp: 1, value: 0.5},
              {timestamp: 2, value: 0.5},
            ],
          },
        },
      },
      match: [MockApiClient.matchQuery({sampling: 'NORMAL', dataset: 'ourlogs'})],
    });

    render(
      <LogsWidgetQueries widget={widget} selection={selection}>
        {({confidence, sampleCount, isSampled, dataScanned}) => (
          <div>
            {confidence}:{sampleCount}:{String(isSampled)}:{dataScanned}
          </div>
        )}
      </LogsWidgetQueries>
    );

    expect(await screen.findByText('low:30:true:partial')).toBeInTheDocument();
  });

  it('calculates confidence and sampling metadata from events-timeseries when enabled', async () => {
    const selection = PageFiltersFixture();
    const widget = WidgetFixture({
      widgetType: WidgetType.LOGS,
      displayType: DisplayType.LINE,
      queries: [
        {
          name: '',
          aggregates: ['count(message)'],
          fields: ['count(message)'],
          columns: [],
          conditions: '',
          orderby: '',
        },
      ],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-timeseries/',
      body: {
        timeSeries: [
          TimeSeriesFixture({
            yAxis: 'count(message)',
            meta: {
              valueType: 'integer',
              valueUnit: null,
              interval: 1000,
              dataScanned: 'partial',
            },
            values: [
              {
                timestamp: 1000,
                value: 10,
                confidence: 'low',
                sampleCount: 10,
                sampleRate: 0.5,
              },
              {
                timestamp: 2000,
                value: 20,
                confidence: 'low',
                sampleCount: 20,
                sampleRate: 0.5,
              },
            ],
          }),
        ],
      },
      match: [MockApiClient.matchQuery({sampling: 'NORMAL', dataset: 'ourlogs'})],
    });

    render(
      <LogsWidgetQueries widget={widget} selection={selection}>
        {({confidence, sampleCount, isSampled, dataScanned}) => (
          <div>
            {confidence}:{sampleCount}:{String(isSampled)}:{dataScanned}
          </div>
        )}
      </LogsWidgetQueries>,
      {
        organization: OrganizationFixture({
          features: ['dashboards-widgets-use-events-timeseries'],
        }),
      }
    );

    expect(await screen.findByText('low:30:true:partial')).toBeInTheDocument();
  });
});
