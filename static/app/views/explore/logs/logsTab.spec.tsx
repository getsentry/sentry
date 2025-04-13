import {LocationFixture} from 'sentry-fixture/locationFixture';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {useLocation} from 'sentry/utils/useLocation';
import {LogsPageParamsProvider} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {LogsTabContent} from 'sentry/views/explore/logs/logsTab';
import {TraceItemDataset} from 'sentry/views/explore/types';

jest.mock('sentry/utils/useLocation');
const mockUseLocation = jest.mocked(useLocation);

describe('LogsTabContent', function () {
  const {organization, project} = initializeOrg({
    organization: {
      features: ['ourlogs', 'ourlogs-graph'],
    },
  });

  let eventTableMock: jest.Mock;
  let eventStatsMock: jest.Mock;
  beforeEach(function () {
    MockApiClient.clearMockResponses();
    mockUseLocation.mockReturnValue(
      LocationFixture({
        pathname: `/organizations/${organization.slug}/explore/logs/?end=2025-04-10T20%3A04%3A51&project=${project.id}&start=2025-04-10T14%3A37%3A55`,
      })
    );
    eventTableMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {
        data: [
          {
            'sentry.item_id': '019621262d117e03bce898cb8f4f6ff7',
            'project.id': 1,
            trace: '17cc0bae407042eaa4bf6d798c37d026',
            severity_number: 9,
            severity_text: 'info',
            timestamp: '2025-04-10T19:21:12+00:00',
            message: 'some log message1',
            'tags[sentry.timestamp_precise,number]': 1.7443128722090732e18,
          },
          {
            'sentry.item_id': '0196212624a17144aa392d01420256a2',
            'project.id': 1,
            trace: 'c331c2df93d846f5a2134203416d40bb',
            severity_number: 9,
            severity_text: 'info',
            timestamp: '2025-04-10T19:21:10+00:00',
            message: 'some log message2',
            'tags[sentry.timestamp_precise,number]': 1.744312870049196e18,
          },
        ],
        meta: {
          fields: {
            'sentry.item_id': 'string',
            'project.id': 'string',
            trace: 'string',
            severity_number: 'integer',
            severity_text: 'string',
            timestamp: 'string',
            message: 'string',
            'tags[sentry.timestamp_precise,number]': 'number',
          },
          units: {
            'sentry.item_id': null,
            'project.id': null,
            trace: null,
            severity_number: null,
            severity_text: null,
            timestamp: null,
            message: null,
            'tags[sentry.timestamp_precise,number]': null,
          },
          isMetricsData: false,
          isMetricsExtractedData: false,
          tips: {},
          datasetReason: 'unchanged',
          dataset: 'ourlogs',
          dataScanned: 'full',
          accuracy: {
            confidence: [{}, {}],
          },
        },
        confidence: [{}, {}],
      },
    });

    eventStatsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      method: 'GET',
      body: {},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/stats/`,
      method: 'GET',
      body: {},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/recent-searches/`,
      method: 'GET',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
      body: {},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/`,
      method: 'GET',
      body: [],
    });
  });

  it('should call APIs as expected', async function () {
    render(
      <TraceItemAttributeProvider traceItemType={TraceItemDataset.LOGS} enabled>
        <LogsPageParamsProvider
          analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
        >
          <LogsTabContent
            defaultPeriod="14d"
            maxPickableDays={7}
            relativeOptions={{
              '1h': 'Last hour',
              '24h': 'Last 24 hours',
              '7d': 'Last 7 days',
            }}
          />
        </LogsPageParamsProvider>
      </TraceItemAttributeProvider>,
      {enableRouterMocks: false, organization}
    );

    expect(eventTableMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/events/`,
      expect.objectContaining({
        query: expect.objectContaining({
          environment: [],
          statsPeriod: '14d',
          dataset: 'ourlogs',
        }),
      })
    );

    expect(eventStatsMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/events-stats/`,
      expect.objectContaining({
        query: expect.objectContaining({
          environment: [],
          statsPeriod: '14d',
          dataset: 'ourlogs',
        }),
      })
    );

    const table = screen.getByTestId('logs-table');
    await screen.findByText('some log message1');
    expect(table).toHaveTextContent(/some log message1/);
    expect(table).toHaveTextContent(/some log message2/);
  });
});
