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
  LOGS_AGGREGATE_FN_KEY,
  LOGS_AGGREGATE_PARAM_KEY,
  LOGS_FIELDS_KEY,
  LOGS_GROUP_BY_KEY,
  LOGS_QUERY_KEY,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LOGS_AGGREGATE_SORT_BYS_KEY} from 'sentry/views/explore/contexts/logs/sortBys';
import {LogsAggregateExportModalButton} from 'sentry/views/explore/logs/exports/logsAggregateExportModalButton';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import type {OurLogsAggregateResponseItem} from 'sentry/views/explore/logs/types';

const mockDownloadFromHref = jest.fn();
jest.mock('sentry/utils/downloadFromHref', () => ({
  downloadFromHref: (...args: unknown[]) => mockDownloadFromHref(...args),
}));

const aggregateRow = (template: string, value: number) =>
  ({
    'message.template': template,
    'p99(severity_number)': value,
  }) as OurLogsAggregateResponseItem;

describe('LogsAggregateExportModalButton', () => {
  const {organization, project} = initializeOrg({
    organization: {features: ['ourlogs-enabled']},
  });

  const tableData = [aggregateRow('one', 17), aggregateRow('two', 13)];

  const nextPageLink =
    '<https://sentry.io/api/0/?cursor=0:100:0>; rel="next"; results="true"; cursor="0:100:0"';

  const lastPageLinks =
    '<https://sentry.io/api/0/?cursor=0:0:1>; rel="previous"; results="true"; cursor="0:0:1", ' +
    '<https://sentry.io/api/0/?cursor=0:200:0>; rel="next"; results="false"; cursor="0:200:0"';

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
        [LOGS_AGGREGATE_SORT_BYS_KEY]: '-p99(severity_number)',
        [LOGS_QUERY_KEY]: '',
        [LOGS_GROUP_BY_KEY]: 'message.template',
        [LOGS_AGGREGATE_FN_KEY]: 'p99',
        [LOGS_AGGREGATE_PARAM_KEY]: 'severity_number',
        [LOGS_FIELDS_KEY]: ['timestamp', 'message'],
      },
    },
    route: '/organizations/:orgId/explore/logs/',
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  function renderButton(pageLinks?: string) {
    render(
      <LogsQueryParamsProvider
        analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
        source="location"
      >
        <LogsAggregateExportModalButton
          error={null}
          isLoading={false}
          pageLinks={pageLinks}
          tableData={tableData}
        />
      </LogsQueryParamsProvider>,
      {initialRouterConfig}
    );
    renderGlobalModal();
  }

  it('downloads locally without a server export when all rows are loaded', async () => {
    const exportRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-export/`,
      method: 'POST',
      body: {},
    });

    renderButton();
    await userEvent.click(screen.getByRole('button', {name: 'Export Data'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Export'}));

    await waitFor(() => {
      expect(mockDownloadFromHref).toHaveBeenCalled();
    });
    expect(exportRequest).not.toHaveBeenCalled();
  });

  it('routes through the server export when more rows remain on the next page', async () => {
    const exportRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-export/`,
      method: 'POST',
      body: {},
    });

    renderButton(nextPageLink);
    await userEvent.click(screen.getByRole('button', {name: 'Export Data'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Export'}));

    await waitFor(() => {
      expect(exportRequest).toHaveBeenCalled();
    });
  });

  it('routes through the server export on the last page of a paginated result', async () => {
    const exportRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-export/`,
      method: 'POST',
      body: {},
    });

    renderButton(lastPageLinks);
    await userEvent.click(screen.getByRole('button', {name: 'Export Data'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Export'}));

    await waitFor(() => {
      expect(exportRequest).toHaveBeenCalled();
    });
  });
});
