import {LogFixture} from 'sentry-fixture/log';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {
  LOGS_FIELDS_KEY,
  LOGS_QUERY_KEY,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LogsDirectExportModalButton} from 'sentry/views/explore/logs/exports/logsDirectExportModalButton';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

const mockDownloadFromHref = jest.fn();

jest.mock('sentry/utils/downloadFromHref', () => ({
  downloadFromHref: (...args: unknown[]) => mockDownloadFromHref(...args),
}));

describe('LogsDirectExportModalButton', () => {
  const {organization, project} = initializeOrg({
    organization: {features: ['ourlogs-enabled']},
  });

  const tableData = [
    LogFixture({
      id: 'log-1',
      [OurLogKnownFieldKey.PROJECT_ID]: project.id,
      [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
      [OurLogKnownFieldKey.MESSAGE]: `${'x'.repeat(256)}...`,
    }),
  ];

  ProjectsStore.loadInitialData([project]);
  PageFiltersStore.init();
  PageFiltersStore.onInitializeUrlState({
    projects: [parseInt(project.id, 10)],
    environments: [],
    datetime: {period: '14d', start: null, end: null, utc: null},
  });

  const initialRouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/explore/logs/`,
      query: {
        project: project.id,
        [LOGS_QUERY_KEY]: '',
        [LOGS_FIELDS_KEY]: ['timestamp', 'message'],
      },
    },
    route: '/organizations/:orgId/explore/logs/',
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
    // A sample count well above the loaded rows, so the modal offers row counts
    // the browser can't serve and the export goes to the server.
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      body: {
        timeSeries: [
          {
            yAxis: 'count(message)',
            values: [{timestamp: 1508208080000, value: 5000, sampleCount: 5000}],
            meta: {valueType: 'integer', valueUnit: null, interval: 3600000},
          },
        ],
      },
    });
  });

  it('asks the server export for the highest accuracy without flex-time windows', async () => {
    const exportRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-export/`,
      method: 'POST',
      body: {},
    });

    render(
      <LogsQueryParamsProvider
        analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
        source="location"
      >
        <LogsDirectExportModalButton
          error={null}
          isLoading={false}
          tableData={tableData}
        />
      </LogsQueryParamsProvider>,
      {initialRouterConfig}
    );
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Export Data'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Export'}));

    await waitFor(() => {
      expect(exportRequest).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/data-export/`,
        expect.objectContaining({
          data: expect.objectContaining({
            query_info: expect.objectContaining({
              sampling: 'HIGHEST_ACCURACY',
            }),
          }),
        })
      );
    });
  });

  it('exports through the server rather than the rows the table truncated for display', async () => {
    const exportRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-export/`,
      method: 'POST',
      body: {},
    });

    render(
      <LogsQueryParamsProvider
        analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
        source="location"
      >
        <LogsDirectExportModalButton
          error={null}
          isLoading={false}
          tableData={tableData}
        />
      </LogsQueryParamsProvider>,
      {initialRouterConfig}
    );
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Export Data'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Export'}));

    await waitFor(() => {
      expect(exportRequest).toHaveBeenCalled();
    });
    expect(mockDownloadFromHref).not.toHaveBeenCalled();
  });
});
