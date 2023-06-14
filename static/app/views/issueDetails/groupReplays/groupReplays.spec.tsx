import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import GroupReplays from 'sentry/views/issueDetails/groupReplays';

jest.mock('sentry/utils/useMedia', () => ({
  __esModule: true,
  default: jest.fn(() => true),
}));

const mockReplayCountUrl = '/organizations/org-slug/replay-count/';
const mockReplayUrl = '/organizations/org-slug/replays/';

type InitializeOrgProps = {
  organizationProps?: {
    features?: string[];
  };
};

const REPLAY_ID_1 = '346789a703f6454384f1de473b8b9fcc';
const REPLAY_ID_2 = 'b05dae9b6be54d21a4d5ad9f8f02b780';

function init({organizationProps = {features: ['session-replay']}}: InitializeOrgProps) {
  const mockProject = TestStubs.Project();
  const {router, organization, routerContext} = initializeOrg({
    organization: {
      ...organizationProps,
    },
    project: mockProject,
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
    },
  });

  ProjectsStore.init();
  ProjectsStore.loadInitialData(organization.projects);

  return {router, organization, routerContext};
}

describe('GroupReplays', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  describe('Replay Feature Disabled', () => {
    const mockGroup = TestStubs.Group();

    const {router, organization, routerContext} = init({
      organizationProps: {features: []},
    });

    it("should show a message when the organization doesn't have access to the replay feature", () => {
      render(<GroupReplays group={mockGroup} />, {
        context: routerContext,
        organization,
        router,
      });

      expect(
        screen.getByText("You don't have access to this feature")
      ).toBeInTheDocument();
    });
  });

  describe('Replay Feature Enabled', () => {
    const {router, organization, routerContext} = init({});

    it('should query the replay-count endpoint with the fetched replayIds', async () => {
      const mockGroup = TestStubs.Group();

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

      render(<GroupReplays group={mockGroup} />, {
        context: routerContext,
        organization,
        router,
      });

      await waitFor(() => {
        expect(mockReplayCountApi).toHaveBeenCalledWith(
          mockReplayCountUrl,
          expect.objectContaining({
            query: {
              returnIds: true,
              query: `issue.id:[${mockGroup.id}]`,
              statsPeriod: '14d',
              project: -1,
            },
          })
        );
        // Expect api path to have the correct query params
        expect(mockReplayApi).toHaveBeenCalledWith(
          mockReplayUrl,
          expect.objectContaining({
            query: expect.objectContaining({
              environment: [],
              field: [
                'activity',
                'browser',
                'count_errors',
                'duration',
                'finished_at',
                'id',
                'is_archived',
                'os',
                'project_id',
                'started_at',
                'urls',
                'user',
              ],
              per_page: 50,
              project: -1,
              queryReferrer: 'issueReplays',
              query: `id:[${REPLAY_ID_1},${REPLAY_ID_2}]`,
              sort: '-started_at',
              statsPeriod: '14d',
            }),
          })
        );
      });
    });

    it('should show empty message when no replays are found', async () => {
      const mockGroup = TestStubs.Group();

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

      const {container} = render(<GroupReplays group={mockGroup} />, {
        context: routerContext,
        organization,
        router,
      });

      expect(
        await screen.findByText('There are no items to display')
      ).toBeInTheDocument();
      expect(mockReplayCountApi).toHaveBeenCalledTimes(1);
      expect(mockReplayApi).toHaveBeenCalledTimes(1);
      expect(container).toSnapshot();
    });

    it('should display error message when api call fails', async () => {
      const mockGroup = TestStubs.Group();

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

      render(<GroupReplays group={mockGroup} />, {
        context: routerContext,
        organization,
        router,
      });

      await waitFor(() => {
        expect(mockReplayCountApi).toHaveBeenCalledTimes(1);
        expect(mockReplayApi).toHaveBeenCalledTimes(1);
        expect(
          screen.getByText('Invalid number: asdf. Expected number.')
        ).toBeInTheDocument();
      });
    });

    it('should display default error message when api call fails without a body', async () => {
      const mockGroup = TestStubs.Group();

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

      render(<GroupReplays group={mockGroup} />, {
        context: routerContext,
        organization,
        router,
      });

      await waitFor(() => {
        expect(mockReplayCountApi).toHaveBeenCalledTimes(1);
        expect(mockReplayApi).toHaveBeenCalledTimes(1);
        expect(
          screen.getByText(
            'Sorry, the list of replays could not be loaded. This could be due to invalid search parameters or an internal systems error.'
          )
        ).toBeInTheDocument();
      });
    });

    it('should show loading indicator when loading replays', async () => {
      const mockGroup = TestStubs.Group();

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

      render(<GroupReplays group={mockGroup} />, {
        context: routerContext,
        organization,
        router,
      });

      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
      await waitFor(() => {
        expect(mockReplayCountApi).toHaveBeenCalledTimes(1);
        expect(mockReplayApi).toHaveBeenCalledTimes(1);
      });
    });

    it('should show a list of replays and have the correct values', async () => {
      const mockGroup = TestStubs.Group();

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
              ...TestStubs.ReplayList()[0],
              count_errors: 1,
              duration: 52346,
              finished_at: new Date('2022-09-15T06:54:00+00:00'),
              id: '346789a703f6454384f1de473b8b9fcc',
              started_at: new Date('2022-09-15T06:50:00+00:00'),
              urls: [
                'https://dev.getsentry.net:7999/organizations/sentry-emerging-tech/replays/',
                '/organizations/sentry-emerging-tech/replays/?project=2',
              ],
            },
            {
              ...TestStubs.ReplayList()[0],
              count_errors: 4,
              duration: 400,
              finished_at: new Date('2022-09-21T21:40:38+00:00'),
              id: 'b05dae9b6be54d21a4d5ad9f8f02b780',
              started_at: new Date('2022-09-21T21:30:44+00:00'),
              urls: [
                'https://dev.getsentry.net:7999/organizations/sentry-emerging-tech/replays/?project=2&statsPeriod=24h',
                '/organizations/sentry-emerging-tech/issues/',
                '/organizations/sentry-emerging-tech/issues/?project=2',
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
      jest.useFakeTimers().setSystemTime(new Date('Sep 28, 2022 11:29:13 PM UTC'));

      render(<GroupReplays group={mockGroup} />, {
        context: routerContext,
        organization,
        router,
      });

      await waitFor(() => {
        expect(mockReplayCountApi).toHaveBeenCalledTimes(1);
        expect(mockReplayApi).toHaveBeenCalledTimes(1);
      });

      // Expect the table to have 2 rows
      expect(screen.getAllByText('testDisplayName')).toHaveLength(2);

      const expectedQuery =
        'query=&referrer=%2Forganizations%2F%3AorgId%2Fissues%2F%3AgroupId%2Freplays%2F&statsPeriod=14d&yAxis=count%28%29';

      // Expect the first row to have the correct href
      expect(screen.getAllByRole('link', {name: 'testDisplayName'})[0]).toHaveAttribute(
        'href',
        `/organizations/org-slug/replays/project-slug:${REPLAY_ID_1}/?${expectedQuery}`
      );

      // Expect the second row to have the correct href
      expect(screen.getAllByRole('link', {name: 'testDisplayName'})[1]).toHaveAttribute(
        'href',
        `/organizations/org-slug/replays/project-slug:${REPLAY_ID_2}/?${expectedQuery}`
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
  });
});
