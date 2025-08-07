import {createLogFixtures, initializeLogsTest} from 'sentry-fixture/log';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {LOGS_AUTO_REFRESH_KEY} from 'sentry/views/explore/contexts/logs/logsAutoRefreshContext';

import LogsPage from './content';

describe('LogsPage', function () {
  const {organization, project, setupPageFilters, setupEventsMock} = initializeLogsTest();

  setupPageFilters();

  let eventTableMock: jest.Mock;
  let eventStatsMock: jest.Mock;

  // Standard log fixtures for consistent testing
  const testDate = new Date('2024-01-15T10:00:00.000Z');
  const {baseFixtures} = createLogFixtures(organization, project, testDate);

  beforeEach(function () {
    MockApiClient.clearMockResponses();

    eventTableMock = setupEventsMock(baseFixtures.slice(0, 2));

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
    render(<LogsPage />, {
      organization,
      initialRouterConfig: {
        location: `/organizations/${organization.slug}/explore/logs/`,
      },
    });

    await waitFor(() => {
      expect(eventTableMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(eventStatsMock).toHaveBeenCalled();
    });

    const table = screen.getByTestId('logs-table');
    expect(
      await screen.findByText('Error occurred in authentication service')
    ).toBeInTheDocument();
    expect(table).not.toHaveTextContent(/auto refresh/i);
    expect(table).toHaveTextContent(/Error occurred in authentication service/);
    expect(table).toHaveTextContent(/User login successful/);
  });

  it('should call aggregates APIs as expected', async function () {
    render(<LogsPage />, {
      organization,
      initialRouterConfig: {
        location: `/organizations/${organization.slug}/explore/logs/`,
      },
    });

    await waitFor(() => {
      expect(eventTableMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(eventStatsMock).toHaveBeenCalled();
    });

    eventTableMock.mockClear();
    eventStatsMock.mockClear();

    await userEvent.click(screen.getByRole('button', {name: 'Expand sidebar'}));
    await userEvent.click(screen.getByRole('button', {name: '\u2014'}));
    await userEvent.click(screen.getByRole('option', {name: 'severity'}));
    await userEvent.click(screen.getByRole('tab', {name: 'Aggregates'}));

    await waitFor(() => {
      expect(eventTableMock).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/events/`,
        expect.objectContaining({
          query: expect.objectContaining({
            environment: [],
            statsPeriod: '24h',
            dataset: 'ourlogs',
            field: ['severity', 'count(message)'],
            sort: '-count(message)',
          }),
        })
      );
    });

    await waitFor(() => {
      expect(eventStatsMock).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/events-stats/`,
        expect.objectContaining({
          query: expect.objectContaining({
            environment: [],
            statsPeriod: '24h',
            dataset: 'ourlogs',
            field: ['severity', 'count(message)'],
            yAxis: 'count(message)',
            orderby: '-count_message',
            interval: '5m',
          }),
        })
      );
    });
  });

  describe('autorefresh flag enabled', () => {
    const {
      organization: autorefreshOrganization,
      setupEventsMock: _setupEventsMock,
      setupTraceItemsMock: _setupTraceItemsMock,
      generateRouterConfig,
      routerConfig: initialRouterConfig,
    } = initializeLogsTest({
      refreshInterval: '10000', // 10 seconds, should not first events multiple times.
      liveRefresh: true,
    });

    const {baseFixtures: autorefreshBaseFixtures} = createLogFixtures(
      autorefreshOrganization,
      project,
      testDate,
      {
        intervalMs: 24 * 60 * 60 * 1000, // 24 hours
      }
    );

    beforeEach(() => {
      eventTableMock.mockClear();
      eventTableMock = _setupEventsMock(autorefreshBaseFixtures.slice(0, 5));
    });

    it('enables autorefresh when Switch is clicked', async function () {
      render(<LogsPage />, {
        organization: autorefreshOrganization,
        initialRouterConfig,
      });

      await waitFor(() => {
        expect(screen.getByTestId('logs-table')).toBeInTheDocument();
      });

      const switchInput = screen.getByRole('checkbox', {name: /auto-refresh/i});
      expect(switchInput).not.toBeChecked();
      expect(switchInput).toBeEnabled();

      await userEvent.click(switchInput);

      await waitFor(() => {
        expect(switchInput).toBeChecked();
      });
    });

    it('pauses auto-refresh when enabled switch is clicked', async function () {
      const {router} = render(<LogsPage />, {
        organization: autorefreshOrganization,
        initialRouterConfig: generateRouterConfig({
          [LOGS_AUTO_REFRESH_KEY]: 'enabled',
        }),
      });
      expect(router.location.query[LOGS_AUTO_REFRESH_KEY]).toBe('enabled');

      await waitFor(() => {
        expect(screen.getByTestId('logs-table')).toBeInTheDocument();
      });

      const switchInput = screen.getByRole('checkbox', {name: /auto-refresh/i});
      expect(switchInput).toBeChecked();

      await userEvent.click(switchInput);

      await waitFor(() => {
        expect(router.location.query[LOGS_AUTO_REFRESH_KEY]).toBe('paused');
      });
      expect(switchInput).not.toBeChecked();
    });

    it('pauses auto-refresh when row is clicked', async function () {
      const rowDetailsMock = _setupTraceItemsMock(autorefreshBaseFixtures.slice(0, 1))[0];
      const {router} = render(<LogsPage />, {
        organization: autorefreshOrganization,
        initialRouterConfig: generateRouterConfig({
          [LOGS_AUTO_REFRESH_KEY]: 'enabled',
        }),
      });

      expect(router.location.query[LOGS_AUTO_REFRESH_KEY]).toBe('enabled');

      await waitFor(() => {
        expect(screen.getByTestId('logs-table')).toBeInTheDocument();
      });

      expect(screen.getAllByTestId('log-table-row')).toHaveLength(5);

      expect(rowDetailsMock).not.toHaveBeenCalled();

      const row = screen.getByText('Error occurred in authentication service');
      await userEvent.click(row.parentElement!.parentElement!); // Avoid clicking the cells which can have their own click handlers.

      await waitFor(() => {
        expect(rowDetailsMock).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(router.location.query[LOGS_AUTO_REFRESH_KEY]).toBe('paused');
      });

      const switchInput = screen.getByRole('checkbox', {name: /auto-refresh/i});
      expect(switchInput).not.toBeChecked();
      expect(switchInput).toBeEnabled();

      expect(eventTableMock).toHaveBeenCalledTimes(1);
      eventTableMock.mockClear();
      eventTableMock = _setupEventsMock(autorefreshBaseFixtures.slice(0, 5));

      await userEvent.click(switchInput);

      await waitFor(() => {
        expect(router.location.query[LOGS_AUTO_REFRESH_KEY]).toBe('enabled');
      });

      expect(eventTableMock).toHaveBeenCalledTimes(1);

      expect(switchInput).toBeChecked();
    });
  });
});
