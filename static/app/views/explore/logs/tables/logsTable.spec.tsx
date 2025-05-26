import {LocationFixture} from 'sentry-fixture/locationFixture';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {useLocation} from 'sentry/utils/useLocation';
import {LogsPageDataProvider} from 'sentry/views/explore/contexts/logs/logsPageData';
import {
  LOGS_FIELDS_KEY,
  LOGS_QUERY_KEY,
  LogsPageParamsProvider,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LOGS_SORT_BYS_KEY} from 'sentry/views/explore/contexts/logs/sortBys';
import {LogsTable} from 'sentry/views/explore/logs/tables/logsTable';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import type {UseLogsQueryResult} from 'sentry/views/explore/logs/useLogsQuery';
import {OrganizationContext} from 'sentry/views/organizationContext';

jest.mock('sentry/utils/useLocation');
const mockUseLocation = jest.mocked(useLocation);

jest.mock('sentry/utils/useRelease', () => ({
  useRelease: jest.fn().mockReturnValue({
    data: {
      id: 10,
      lastCommit: {
        id: '1e5a9462e6ac23908299b218e18377837297bda1',
      },
    },
  }),
}));

jest.mock('sentry/components/events/interfaces/frame/useStacktraceLink', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({
    data: {
      sourceUrl: 'https://some-stacktrace-link',
      integrations: [],
    },
    error: null,
    isPending: false,
  }),
}));

describe('LogsTable', function () {
  const {organization, project} = initializeOrg({
    organization: {
      features: ['ourlogs-enabled'],
    },
  });
  ProjectsStore.loadInitialData([project]);

  PageFiltersStore.init();
  PageFiltersStore.onInitializeUrlState(
    {
      projects: [parseInt(project.id, 10)],
      environments: [],
      datetime: {
        period: '14d',
        start: null,
        end: null,
        utc: null,
      },
    },
    new Set()
  );

  const tableData = {
    data: [
      {
        'sentry.item_id': '0196a1bc022d76d3bff2106ebbf65f49',
        'project.id': project.id,
        trace: '32986bcdac1f43ed87445a2021b0099c',
        severity_number: 9,
        severity: 'info',
        timestamp: '2025-05-05T18:36:15+00:00',
        message:
          '10.5.55.212 - - [05/May/2025:18:36:15 +0000] "POST /v1/automation/autofix/state HTTP/1.1" 200 293642 "-" "python-requests/2.32.3"',
        'sentry.release': '985bae16edc2f3f8132e346a4f6c5a559f7c968b',
        'code.file.path': '/usr/local/lib/python3.11/dist-packages/gunicorn/glogging.py',
        'tags[sentry.timestamp_precise,number]': 1.7464701752771756e18,
      },
      {
        'sentry.item_id': '0196a1bc00e3720f8d47c84c53131891',
        'project.id': project.id,
        trace: '6141dca24986471398232d340a4fd588',
        severity_number: 9,
        severity: 'info',
        timestamp: '2025-05-05T18:36:14+00:00',
        message:
          '10.5.58.189 - - [05/May/2025:18:36:14 +0000] "POST /v0/issues/similar-issues HTTP/1.1" 200 131 "-" "python-urllib3/2.2.2"',
        'sentry.release': '985bae16edc2f3f8132e346a4f6c5a559f7c968b',
        'code.file.path': '/usr/local/lib/python3.11/dist-packages/gunicorn/glogging.py',
        'tags[sentry.timestamp_precise,number]': 1.746470174947077e18,
      },
      {
        'sentry.item_id': '0196a1bc007c7dfbbe099b6328e41d12',
        'project.id': project.id,
        trace: '6141dca24986471398232d340a4fd588',
        severity_number: 9,
        severity: 'info',
        timestamp: '2025-05-05T18:36:14+00:00',
        message:
          '10.5.62.140 - - [05/May/2025:18:36:14 +0000] "POST /v0/issues/similar-issues HTTP/1.1" 200 586 "-" "python-urllib3/2.2.2"',
        'sentry.release': '985bae16edc2f3f8132e346a4f6c5a559f7c968b',
        'code.file.path': '/usr/local/lib/python3.11/dist-packages/gunicorn/glogging.py',
        'tags[sentry.timestamp_precise,number]': 1.7464701748443016e18,
      },
    ],
    meta: {
      fields: {
        'sentry.item_id': 'string',
        'project.id': 'string',
        trace: 'string',
        severity_number: 'integer',
        severity: 'string',
        timestamp: 'string',
        message: 'string',
        'sentry.release': 'string',
        'code.file.path': 'string',
        'tags[sentry.timestamp_precise,number]': 'number',
      },
    },
    isLoading: false,
    isPending: false,
    isError: false,
    error: null,
    pageLinks: undefined,
  } as unknown as UseLogsQueryResult;

  const visibleColumnFields = [
    'message',
    'trace',
    'severity_number',
    'severity',
    'timestamp',
    'sentry.release',
    'code.file.path',
  ];
  const frozenColumnFields = [OurLogKnownFieldKey.TIMESTAMP, OurLogKnownFieldKey.MESSAGE];

  function ProviderWrapper({
    children,
    isTableFrozen = false,
  }: {
    children: React.ReactNode;
    isTableFrozen?: boolean;
  }) {
    return (
      <OrganizationContext.Provider value={organization}>
        <LogsPageParamsProvider
          analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
          isTableFrozen={isTableFrozen}
        >
          <LogsPageDataProvider>{children}</LogsPageDataProvider>
        </LogsPageParamsProvider>
      </OrganizationContext.Provider>
    );
  }

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    mockUseLocation.mockReturnValue(
      LocationFixture({
        pathname: `/organizations/${organization.slug}/explore/logs/?end=2025-04-10T20%3A04%3A51&project=${project.id}&start=2025-04-10T14%3A37%3A55`,
        query: {
          [LOGS_FIELDS_KEY]: visibleColumnFields,
          [LOGS_SORT_BYS_KEY]: '-timestamp',
          [LOGS_QUERY_KEY]: 'severity:error',
        },
      })
    );

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: tableData,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/stats/`,
      method: 'GET',
      body: {},
    });

    (tableData?.data ?? []).forEach(log => {
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/trace-items/${log['sentry.item_id']}/`,
        method: 'GET',
        body: {
          data: {
            id: log['sentry.item_id'],
            projectId: project.id,
            traceId: log.trace,
            type: 'log',
            timestamp: log.timestamp,
            message: log.message,
          },
        },
      });
    });
  });

  it('should be interactable', async () => {
    render(
      <ProviderWrapper>
        <LogsTable showHeader />
      </ProviderWrapper>
    );

    const allTreeRows = await screen.findAllByTestId('log-table-row');
    expect(allTreeRows).toHaveLength(3);
    for (const row of allTreeRows) {
      for (const field of visibleColumnFields) {
        const cell = await within(row).findByTestId(`log-table-cell-${field}`);
        await userEvent.hover(cell);
        const actionsButton = within(cell).queryByRole('button', {
          name: 'Actions',
        });
        if (field === 'timestamp') {
          expect(actionsButton).toBeNull();
        } else {
          expect(actionsButton).toBeInTheDocument();
        }
      }
    }
  });

  it('should not be interactable on embedded views', async () => {
    render(
      <ProviderWrapper isTableFrozen>
        <LogsTable showHeader />
      </ProviderWrapper>
    );

    const allTreeRows = await screen.findAllByTestId('log-table-row');
    expect(allTreeRows).toHaveLength(3);
    for (const row of allTreeRows) {
      for (const field of frozenColumnFields) {
        const cell = await within(row).findByTestId(`log-table-cell-${field}`);
        await userEvent.hover(cell);
        const actionsButton = within(cell).queryByRole('button', {
          name: 'Actions',
        });
        expect(actionsButton).not.toBeInTheDocument();
      }
    }
  });
});
