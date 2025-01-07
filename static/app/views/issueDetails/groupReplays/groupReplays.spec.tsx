import {duration} from 'moment-timezone';
import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';
import {RRWebInitFrameEventsFixture} from 'sentry-fixture/replay/rrweb';
import {ReplayListFixture} from 'sentry-fixture/replayList';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {resetMockDate, setMockDate} from 'sentry-test/utils';

import ProjectsStore from 'sentry/stores/projectsStore';
import useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import ReplayReader from 'sentry/utils/replays/replayReader';
import GroupReplays from 'sentry/views/issueDetails/groupReplays';

const mockReplayCountUrl = '/organizations/org-slug/replay-count/';
const mockReplayUrl = '/organizations/org-slug/replays/';

const REPLAY_ID_1 = '346789a703f6454384f1de473b8b9fcc';
const REPLAY_ID_2 = 'b05dae9b6be54d21a4d5ad9f8f02b780';

jest.mock('sentry/utils/replays/hooks/useLoadReplayReader');
const mockUseLoadReplayReader = jest.mocked(useLoadReplayReader);

const mockEventTimestamp = new Date('2022-09-22T16:59:41Z');
const mockEventTimestampMs = mockEventTimestamp.getTime();

// Get replay data with the mocked replay reader params
const mockReplay = ReplayReader.factory({
  replayRecord: ReplayRecordFixture({
    id: REPLAY_ID_1,
    browser: {
      name: 'Chrome',
      version: '110.0.0',
    },
    started_at: new Date('Sep 22, 2022 4:58:39 PM UTC'),
    finished_at: new Date(mockEventTimestampMs + 5_000),
    duration: duration(10, 'seconds'),
  }),
  errors: [],
  fetching: false,
  attachments: RRWebInitFrameEventsFixture({
    timestamp: new Date('Sep 22, 2022 4:58:39 PM UTC'),
  }),
  clipWindow: {
    startTimestampMs: mockEventTimestampMs - 5_000,
    endTimestampMs: mockEventTimestampMs + 5_000,
  },
});

mockUseLoadReplayReader.mockImplementation(() => {
  return {
    attachments: [],
    errors: [],
    fetchError: undefined,
    fetching: false,
    onRetry: jest.fn(),
    projectSlug: ProjectFixture().slug,
    replay: mockReplay,
    replayId: REPLAY_ID_1,
    replayRecord: ReplayRecordFixture({id: REPLAY_ID_1}),
  };
});

type InitializeOrgProps = {
  organizationProps?: {
    features?: string[];
  };
};

describe('GroupReplays', () => {
  const mockGroup = GroupFixture();

  function init({
    organizationProps = {features: ['session-replay']},
  }: InitializeOrgProps) {
    const mockProject = ProjectFixture();
    const {router, projects, organization} = initializeOrg({
      organization: {
        ...organizationProps,
      },
      projects: [mockProject],
      router: {
        routes: [
          {path: '/'},
          {path: '/organizations/:orgId/issues/:groupId/'},
          {path: 'replays/'},
        ],
        location: {
          pathname: '/organizations/org-slug/replays/',
          query: {},
        },
        params: {
          orgId: 'org-slug',
          groupId: mockGroup.id,
        },
      },
    });

    ProjectsStore.init();
    ProjectsStore.loadInitialData(projects);

    return {router, organization};
  }

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${mockGroup.id}/`,
      body: mockGroup,
    });
  });
  afterEach(() => {
    resetMockDate();
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
  });

  describe('Replay Feature Disabled', () => {
    it("should show a message when the organization doesn't have access to the replay feature", () => {
      const {router, organization} = init({organizationProps: {features: []}});
      render(<GroupReplays />, {
        router,
        organization,
      });

      expect(
        screen.getByText("You don't have access to this feature")
      ).toBeInTheDocument();
    });
  });

  describe('Replay Feature Enabled', () => {
    it('should query the replay-count endpoint with the fetched replayIds', async () => {
      const {router, organization} = init({});

      const mockReplayCountApi = MockApiClient.addMockResponse({
        url: mockReplayCountUrl,
        body: {
          [mockGroup.id]: [REPLAY_ID_1, REPLAY_ID_2],
        },
      });

      const mockReplayApi = MockApiClient.addMockResponse({
        url: mockReplayUrl,
        body: {
          data: [],
        },
      });

      render(<GroupReplays />, {
        router,
        organization,
      });

      await waitFor(() => {
        expect(mockReplayCountApi).toHaveBeenCalledWith(
          mockReplayCountUrl,
          expect.objectContaining({
            query: {
              returnIds: true,
              data_source: 'discover',
              query: `issue.id:[${mockGroup.id}]`,
              statsPeriod: '90d',
              project: -1,
            },
          })
        );
      });
      // Expect api path to have the correct query params
      expect(mockReplayApi).toHaveBeenCalledWith(
        mockReplayUrl,
        expect.objectContaining({
          query: expect.objectContaining({
            environment: [],
            field: [
              'activity',
              'browser',
              'count_dead_clicks',
              'count_errors',
              'count_rage_clicks',
              'duration',
              'finished_at',
              'has_viewed',
              'id',
              'is_archived',
              'os',
              'project_id',
              'started_at',
              'user',
            ],
            per_page: 50,
            project: -1,
            queryReferrer: 'issueReplays',
            query: `id:[${REPLAY_ID_1},${REPLAY_ID_2}]`,
            sort: '-started_at',
            statsPeriod: '90d',
          }),
        })
      );
    });

    it('should show empty message when no replays are found', async () => {
      const {router, organization} = init({});

      const mockReplayCountApi = MockApiClient.addMockResponse({
        url: mockReplayCountUrl,
        body: {
          [mockGroup.id]: [REPLAY_ID_1, REPLAY_ID_2],
        },
      });

      const mockReplayApi = MockApiClient.addMockResponse({
        url: mockReplayUrl,
        body: {
          data: [],
        },
      });

      render(<GroupReplays />, {
        router,
        organization,
      });

      expect(
        await screen.findByText('There are no items to display')
      ).toBeInTheDocument();
      expect(mockReplayCountApi).toHaveBeenCalled();
      expect(mockReplayApi).toHaveBeenCalledTimes(1);
    });

    it('should display error message when api call fails', async () => {
      const {router, organization} = init({});

      const mockReplayCountApi = MockApiClient.addMockResponse({
        url: mockReplayCountUrl,
        body: {
          [mockGroup.id]: [REPLAY_ID_1, REPLAY_ID_2],
        },
      });

      const mockReplayApi = MockApiClient.addMockResponse({
        url: mockReplayUrl,
        statusCode: 500,
        body: {
          detail: 'Invalid number: asdf. Expected number.',
        },
      });

      render(<GroupReplays />, {
        router,
        organization,
      });

      expect(
        await screen.findByText(
          'Sorry, the list of replays could not be loaded. Invalid number: asdf. Expected number.'
        )
      ).toBeInTheDocument();

      await waitFor(() => {
        expect(mockReplayCountApi).toHaveBeenCalled();
      });
      expect(mockReplayApi).toHaveBeenCalledTimes(1);
    });

    it('should display default error message when api call fails without a body', async () => {
      const {router, organization} = init({});

      const mockReplayCountApi = MockApiClient.addMockResponse({
        url: mockReplayCountUrl,
        body: {
          [mockGroup.id]: [REPLAY_ID_1, REPLAY_ID_2],
        },
      });

      const mockReplayApi = MockApiClient.addMockResponse({
        url: mockReplayUrl,
        statusCode: 500,
        body: {},
      });

      render(<GroupReplays />, {
        router,
        organization,
      });

      expect(
        await screen.findByText(
          'Sorry, the list of replays could not be loaded. This could be due to invalid search parameters or an internal systems error.'
        )
      ).toBeInTheDocument();

      await waitFor(() => {
        expect(mockReplayCountApi).toHaveBeenCalled();
      });
      expect(mockReplayApi).toHaveBeenCalledTimes(1);
    });

    it('should show loading indicator when loading replays', async () => {
      const {router, organization} = init({});

      const mockReplayCountApi = MockApiClient.addMockResponse({
        url: mockReplayCountUrl,
        body: {
          [mockGroup.id]: [REPLAY_ID_1, REPLAY_ID_2],
        },
      });

      const mockReplayApi = MockApiClient.addMockResponse({
        url: mockReplayUrl,
        statusCode: 200,
        body: {
          data: [],
        },
      });

      render(<GroupReplays />, {
        router,
        organization,
      });

      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
      await waitFor(() => {
        expect(mockReplayCountApi).toHaveBeenCalled();
      });
      expect(mockReplayApi).toHaveBeenCalledTimes(1);
    });

    it('should show a list of replays and have the correct values', async () => {
      const {router, organization} = init({});

      const mockReplayCountApi = MockApiClient.addMockResponse({
        url: mockReplayCountUrl,
        body: {
          [mockGroup.id]: [REPLAY_ID_1, REPLAY_ID_2],
        },
      });

      const mockReplayApi = MockApiClient.addMockResponse({
        url: mockReplayUrl,
        statusCode: 200,
        body: {
          data: [
            {
              ...ReplayListFixture()[0],
              count_errors: 1,
              duration: 52346,
              finished_at: new Date('2022-09-15T06:54:00+00:00'),
              id: REPLAY_ID_1,
              started_at: new Date('2022-09-15T06:50:00+00:00'),
              urls: [
                'https://dev.getsentry.net:7999/replays/',
                '/organizations/org-slug/replays/?project=2',
              ],
            },
            {
              ...ReplayListFixture()[0],
              count_errors: 4,
              duration: 400,
              finished_at: new Date('2022-09-21T21:40:38+00:00'),
              id: REPLAY_ID_2,
              started_at: new Date('2022-09-21T21:30:44+00:00'),
              urls: [
                'https://dev.getsentry.net:7999/organizations/org-slug/replays/?project=2&statsPeriod=24h',
                '/organizations/org-slug/issues/',
                '/organizations/org-slug/issues/?project=2',
              ],
            },
          ].map(hydrated => ({
            ...hydrated,
            started_at: hydrated.started_at.toString(),
            finished_at: hydrated.finished_at.toString(),
          })),
        },
      });

      // Mock the system date to be 2022-09-28
      setMockDate(new Date('Sep 28, 2022 11:29:13 PM UTC'));

      render(<GroupReplays />, {
        router,
        organization,
      });

      await waitFor(() => {
        expect(mockReplayCountApi).toHaveBeenCalled();
      });
      expect(mockReplayApi).toHaveBeenCalledTimes(1);

      // Expect the table to have 2 rows
      expect(await screen.findAllByText('testDisplayName')).toHaveLength(2);

      const expectedQuery =
        'query=&referrer=%2Forganizations%2F%3AorgId%2Fissues%2F%3AgroupId%2Freplays%2F&statsPeriod=14d&yAxis=count%28%29';

      // Expect the first row to have the correct href
      expect(screen.getAllByRole('link', {name: 'testDisplayName'})[0]).toHaveAttribute(
        'href',
        `/organizations/org-slug/replays/${REPLAY_ID_1}/?${expectedQuery}`
      );

      // Expect the second row to have the correct href
      expect(screen.getAllByRole('link', {name: 'testDisplayName'})[1]).toHaveAttribute(
        'href',
        `/organizations/org-slug/replays/${REPLAY_ID_2}/?${expectedQuery}`
      );

      // Expect the first row to have the correct duration
      expect(screen.getByText('14:32:26')).toBeInTheDocument();

      // Expect the second row to have the correct duration
      expect(screen.getByText('06:40')).toBeInTheDocument();

      // Expect the first row to have the correct errors
      expect(screen.getAllByTestId('replay-table-count-errors')[0]).toHaveTextContent(
        '1'
      );

      // Expect the second row to have the correct errors
      expect(screen.getAllByTestId('replay-table-count-errors')[1]).toHaveTextContent(
        '4'
      );

      // Expect the first row to have the correct date
      expect(screen.getByText('14 days ago')).toBeInTheDocument();

      // Expect the second row to have the correct date
      expect(screen.getByText('7 days ago')).toBeInTheDocument();
    });

    it('Should render the replay player when replay-play-from-replay-tab is enabled', async () => {
      const {router, organization} = init({
        organizationProps: {features: ['replay-play-from-replay-tab', 'session-replay']},
      });

      const mockReplayCountApi = MockApiClient.addMockResponse({
        url: mockReplayCountUrl,
        body: {
          [mockGroup.id]: [REPLAY_ID_1, REPLAY_ID_2],
        },
      });
      MockApiClient.addMockResponse({
        url: mockReplayUrl,
        statusCode: 200,
        body: {
          data: [
            {
              ...ReplayListFixture()[0],
              count_errors: 1,
              duration: 52346,
              finished_at: new Date('2022-09-15T06:54:00+00:00'),
              id: REPLAY_ID_1,
              started_at: new Date('2022-09-15T06:50:00+00:00'),
              urls: [
                'https://dev.getsentry.net:7999/replays/',
                '/organizations/org-slug/replays/?project=2',
              ],
            },
            {
              ...ReplayListFixture()[0],
              count_errors: 4,
              duration: 400,
              finished_at: new Date('2022-09-21T21:40:38+00:00'),
              id: REPLAY_ID_2,
              started_at: new Date('2022-09-21T21:30:44+00:00'),
              urls: [
                'https://dev.getsentry.net:7999/organizations/org-slug/replays/?project=2&statsPeriod=24h',
                '/organizations/org-slug/issues/',
                '/organizations/org-slug/issues/?project=2',
              ],
            },
          ].map(hydrated => ({
            ...hydrated,
            started_at: hydrated.started_at.toString(),
            finished_at: hydrated.finished_at.toString(),
          })),
        },
      });

      render(<GroupReplays />, {
        router,
        organization,
      });

      expect(await screen.findByText('See Full Replay')).toBeInTheDocument();
      expect(mockReplayCountApi).toHaveBeenCalledWith(
        mockReplayCountUrl,
        expect.objectContaining({
          query: {
            returnIds: true,
            data_source: 'discover',
            query: `issue.id:[${mockGroup.id}]`,
            statsPeriod: '90d',
            project: -1,
          },
        })
      );
    });

    it('Should switch replays when clicking and replay-play-from-replay-tab is enabled', async () => {
      const {router, organization} = init({
        organizationProps: {features: ['session-replay']},
      });
      const mockReplayRecord = mockReplay?.getReplay();

      const mockReplayCountApi = MockApiClient.addMockResponse({
        url: mockReplayCountUrl,
        body: {
          [mockGroup.id]: [REPLAY_ID_1, REPLAY_ID_2],
        },
      });
      MockApiClient.addMockResponse({
        url: mockReplayUrl,
        statusCode: 200,
        body: {
          data: [
            {
              ...ReplayListFixture()[0],
              count_errors: 1,
              duration: 52346,
              finished_at: new Date('2022-09-15T06:54:00+00:00'),
              id: REPLAY_ID_1,
              started_at: new Date('2022-09-15T06:50:00+00:00'),
              urls: [
                'https://dev.getsentry.net:7999/replays/',
                '/organizations/org-slug/replays/?project=2',
              ],
            },
            {
              ...ReplayListFixture()[0],
              count_errors: 4,
              duration: 400,
              finished_at: new Date('2022-09-21T21:40:38+00:00'),
              id: REPLAY_ID_2,
              started_at: new Date('2022-09-21T21:30:44+00:00'),
              urls: [
                'https://dev.getsentry.net:7999/organizations/org-slug/replays/?project=2&statsPeriod=24h',
                '/organizations/org-slug/issues/',
                '/organizations/org-slug/issues/?project=2',
              ],
            },
          ].map(hydrated => ({
            ...hydrated,
            started_at: hydrated.started_at.toString(),
            finished_at: hydrated.finished_at.toString(),
          })),
        },
      });
      MockApiClient.addMockResponse({
        method: 'POST',
        url: `/projects/${organization.slug}/${mockReplayRecord?.project_id}/replays/${mockReplayRecord?.id}/viewed-by/`,
      });

      render(<GroupReplays />, {
        router,
        organization,
      });

      await waitFor(() => {
        expect(mockReplayCountApi).toHaveBeenCalledWith(
          mockReplayCountUrl,
          expect.objectContaining({
            query: {
              returnIds: true,
              data_source: 'discover',
              query: `issue.id:[${mockGroup.id}]`,
              statsPeriod: '90d',
              project: -1,
            },
          })
        );
      });

      const replayPlayPlause = (
        await screen.findAllByTestId('replay-table-play-button')
      )[0]!;
      await userEvent.click(replayPlayPlause);

      await waitFor(() =>
        expect(router.replace).toHaveBeenCalledWith(
          expect.objectContaining({
            pathname: '/organizations/org-slug/replays/',
            query: {
              selected_replay_index: 1,
            },
          })
        )
      );
    });
  });
});
