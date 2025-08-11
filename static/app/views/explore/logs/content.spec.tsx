import {createLogFixtures, initializeLogsTest} from 'sentry-fixture/log';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';
import {TeamFixture} from 'sentry-fixture/team';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as useRecentCreatedProjectHook from 'sentry/components/onboarding/useRecentCreatedProject';
import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {LOGS_AUTO_REFRESH_KEY} from 'sentry/views/explore/contexts/logs/logsAutoRefreshContext';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';

import LogsPage from './content';

describe('LogsPage', function () {
  let organization: Organization;
  let project: Project;
  let testDate: Date;

  let eventTableMock: jest.Mock;
  let eventStatsMock: jest.Mock;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    const {
      organization: _organization,
      project: _project,
      setupPageFilters,
      setupEventsMock,
    } = initializeLogsTest();

    organization = _organization;
    project = _project;

    setupPageFilters();

    // Standard log fixtures for consistent testing
    testDate = new Date('2024-01-15T10:00:00.000Z');
    const {baseFixtures} = createLogFixtures(organization, project, testDate);

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

  it('should show onboarding when project is not onboarded', async function () {
    ProjectsStore.reset();
    const {
      organization: onboardingOrganization,
      project: onboardingProject,
      setupPageFilters: onboardingSetupPageFilters,
    } = initializeLogsTest({
      project: {
        hasLogs: false,
        platform: 'javascript-react',
      },
    });
    TeamStore.loadInitialData([TeamFixture()]);
    MockApiClient.addMockResponse({
      url: `/projects/${onboardingOrganization.slug}/${onboardingProject.slug}/`,
      method: 'GET',
      body: [],
    });
    const projectSlugMock = MockApiClient.addMockResponse({
      url: `/projects/${onboardingOrganization.slug}/${onboardingProject.slug}/keys/`,
      method: 'GET',
      body: [ProjectKeysFixture()[0]],
    });
    const sdkMock = MockApiClient.addMockResponse({
      url: `/organizations/${onboardingOrganization.slug}/sdks/`,
      method: 'GET',
      body: [],
    });

    jest
      .spyOn(useRecentCreatedProjectHook, 'useRecentCreatedProject')
      .mockImplementation(() => {
        return {
          project: onboardingProject,
          isProjectActive: true,
        };
      });

    onboardingSetupPageFilters();

    render(<LogsPage />, {
      organization,
      initialRouterConfig: {
        location: `/organizations/${organization.slug}/explore/logs/`,
      },
    });

    expect(projectSlugMock).toHaveBeenCalled();
    expect(sdkMock).toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByText('Your Source for Log-ical Data')).toBeInTheDocument();
    });
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
    let initialRouterConfig: ReturnType<typeof initializeLogsTest>['routerConfig'];
    let autorefreshBaseFixtures: OurLogsResponseItem[];
    let setupTraceItemsMock: ReturnType<typeof initializeLogsTest>['setupTraceItemsMock'];
    let setupEventsMock: ReturnType<typeof initializeLogsTest>['setupEventsMock'];

    beforeEach(() => {
      eventTableMock.mockClear();

      const {
        organization: autorefreshOrganization,
        setupEventsMock: _setupEventsMock,
        project: _project,
        setupTraceItemsMock: _setupTraceItemsMock,
        routerConfig,
      } = initializeLogsTest({
        refreshInterval: '10000', // 10 seconds, should not first events multiple times.
        liveRefresh: true,
      });
      organization = autorefreshOrganization;
      project = _project;
      initialRouterConfig = routerConfig;
      setupTraceItemsMock = _setupTraceItemsMock;
      setupEventsMock = _setupEventsMock;
      const {baseFixtures} = createLogFixtures(organization, project, testDate, {
        intervalMs: 24 * 60 * 60 * 1000, // 24 hours
      });
      eventTableMock = _setupEventsMock(baseFixtures.slice(0, 5));
      autorefreshBaseFixtures = baseFixtures;
    });

    it('enables autorefresh when Switch is clicked', async function () {
      render(<LogsPage />, {
        organization,
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
        organization,
        initialRouterConfig: {
          ...initialRouterConfig,
          location: {
            ...initialRouterConfig.location,
            query: {
              ...initialRouterConfig.location.query,
              [LOGS_AUTO_REFRESH_KEY]: 'enabled',
            },
          },
        },
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
      const rowDetailsMock = setupTraceItemsMock(autorefreshBaseFixtures.slice(0, 1))[0];
      const {router} = render(<LogsPage />, {
        organization,
        initialRouterConfig: {
          ...initialRouterConfig,
          location: {
            ...initialRouterConfig.location,
            query: {
              ...initialRouterConfig.location.query,
              [LOGS_AUTO_REFRESH_KEY]: 'enabled',
            },
          },
        },
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
      eventTableMock = setupEventsMock(autorefreshBaseFixtures.slice(0, 5));

      await userEvent.click(switchInput);

      await waitFor(() => {
        expect(router.location.query[LOGS_AUTO_REFRESH_KEY]).toBe('enabled');
      });

      expect(eventTableMock).toHaveBeenCalledTimes(1);

      expect(switchInput).toBeChecked();
    });
  });
});
