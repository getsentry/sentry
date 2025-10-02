import {initializeLogsTest} from 'sentry-fixture/log';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {LOGS_QUERY_KEY} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LOGS_SORT_BYS_KEY} from 'sentry/views/explore/contexts/logs/sortBys';
import {QUERY_PAGE_LIMIT} from 'sentry/views/explore/logs/constants';
import {LogsExportButton} from 'sentry/views/explore/logs/logsExport';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

jest.mock('sentry/views/explore/logs/logsExportCsv');

describe('LogsExportButton', () => {
  const {organization, setupPageFilters} = initializeLogsTest({
    organization: {features: ['ourlogs-enabled', 'ourlogs-export', 'discover-query']},
  });
  const initialRouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/explore/logs/`,
      query: {
        [LOGS_SORT_BYS_KEY]: '-timestamp',
        [LOGS_QUERY_KEY]: 'severity:error level:warning',
      },
    },
    route: '/organizations/:orgId/explore/logs/',
  };

  function ProviderWrapper({children}: {children: React.ReactNode}) {
    return (
      <LogsQueryParamsProvider
        analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
        source="location"
      >
        {children}
      </LogsQueryParamsProvider>
    );
  }

  const mockTableData = [
    {
      [OurLogKnownFieldKey.ID]: '019621262d117e03bce898cb8f4f6ff7',
      [OurLogKnownFieldKey.PROJECT_ID]: '1',
      [OurLogKnownFieldKey.ORGANIZATION_ID]: 1,
      [OurLogKnownFieldKey.TRACE_ID]: '17cc0bae407042eaa4bf6d798c37d026',
      [OurLogKnownFieldKey.SEVERITY_NUMBER]: 9,
      [OurLogKnownFieldKey.SEVERITY]: 'info',
      [OurLogKnownFieldKey.TIMESTAMP]: '2025-04-10T19:21:12+00:00',
      [OurLogKnownFieldKey.MESSAGE]: 'some log message1',
      [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: 1.7443128722090732e18,
      [OurLogKnownFieldKey.OBSERVED_TIMESTAMP_PRECISE]: 1.7443128722090732e18,
    },
    {
      [OurLogKnownFieldKey.ID]: '0196212624a17144aa392d01420256a2',
      [OurLogKnownFieldKey.PROJECT_ID]: '1',
      [OurLogKnownFieldKey.ORGANIZATION_ID]: 1,
      [OurLogKnownFieldKey.TRACE_ID]: 'c331c2df93d846f5a2134203416d40bb',
      [OurLogKnownFieldKey.SEVERITY_NUMBER]: 9,
      [OurLogKnownFieldKey.SEVERITY]: 'info',
      [OurLogKnownFieldKey.TIMESTAMP]: '2025-04-10T19:21:10+00:00',
      [OurLogKnownFieldKey.MESSAGE]: 'some log message2',
      [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: 1.744312870049196e18,
      [OurLogKnownFieldKey.OBSERVED_TIMESTAMP_PRECISE]: 1.744312870049196e18,
    },
  ];

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    setupPageFilters();
  });

  it('should render browser export button for small datasets', () => {
    render(
      <ProviderWrapper>
        <LogsExportButton isLoading={false} tableData={mockTableData} error={null} />
      </ProviderWrapper>,
      {initialRouterConfig, organization}
    );

    expect(screen.getByTestId('export-download-csv')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Export'})).toBeInTheDocument();
  });

  it('should send correct payload for async export with all LogsQueryInfo parameters', async () => {
    const largeTableData = new Array(QUERY_PAGE_LIMIT).fill(mockTableData[0]);

    const exportMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-export/`,
      method: 'POST',
      body: {id: 721},
    });

    render(
      <ProviderWrapper>
        <LogsExportButton isLoading={false} tableData={largeTableData} error={null} />
      </ProviderWrapper>,
      {initialRouterConfig, organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Export'}));

    expect(exportMock).toHaveBeenCalledWith('/organizations/org-slug/data-export/', {
      data: {
        query_info: {
          dataset: 'logs',
          end: undefined,
          environment: [],
          field: ['timestamp', 'message'],
          project: [2],
          query: 'severity:error level:warning',
          sort: ['-timestamp'],
          start: undefined,
          statsPeriod: '14d',
        },
        query_type: 'Explore',
      },
      error: expect.any(Function),
      method: 'POST',
      success: expect.any(Function),
    });
  });

  it('should handle CSV export for small datasets', async () => {
    const mockDownloadLogsAsCsv = jest.mocked(
      require('sentry/views/explore/logs/logsExportCsv').downloadLogsAsCsv
    );

    render(
      <ProviderWrapper>
        <LogsExportButton isLoading={false} tableData={mockTableData} error={null} />
      </ProviderWrapper>,
      {initialRouterConfig, organization}
    );

    await userEvent.click(screen.getByTestId('export-download-csv'));

    expect(mockDownloadLogsAsCsv).toHaveBeenCalledWith(
      mockTableData,
      ['timestamp', 'message'],
      'logs'
    );
  });

  it('should disable button when loading', () => {
    render(
      <ProviderWrapper>
        <LogsExportButton isLoading tableData={mockTableData} error={null} />
      </ProviderWrapper>,
      {initialRouterConfig, organization}
    );

    expect(screen.getByRole('button', {name: 'Export'})).toBeDisabled();
  });

  it('should disable button when there is an error', () => {
    render(
      <ProviderWrapper>
        <LogsExportButton
          isLoading={false}
          tableData={mockTableData}
          error={new Error('Test error')}
        />
      </ProviderWrapper>,
      {initialRouterConfig, organization}
    );

    expect(screen.getByRole('button', {name: 'Export'})).toBeDisabled();
  });

  it('should disable button when table data is empty', () => {
    render(
      <ProviderWrapper>
        <LogsExportButton isLoading={false} tableData={[]} error={null} />
      </ProviderWrapper>,
      {initialRouterConfig, organization}
    );

    expect(screen.getByRole('button', {name: 'Export'})).toBeDisabled();
  });
});
