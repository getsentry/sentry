import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import GroupReplays from 'sentry/views/organizationGroupDetails/groupReplays';

jest.mock('sentry/utils/useMedia', () => ({
  __esModule: true,
  default: jest.fn(() => true),
}));

const mockEventsUrl = '/organizations/org-slug/events/';
const mockReplayUrl = '/organizations/org-slug/replays/';

type InitializeOrgProps = {
  organizationProps?: {
    features?: string[];
  };
};

function init({
  organizationProps = {features: ['session-replay-ui']},
}: InitializeOrgProps) {
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

    it('should query the events endpoint with the fetched replayIds', async () => {
      const mockGroup = TestStubs.Group();

      const mockEventsApi = MockApiClient.addMockResponse({
        url: mockEventsUrl,
        body: {
          data: [
            {replayId: '346789a703f6454384f1de473b8b9fcc', 'count()': 1},
            {replayId: 'b05dae9b6be54d21a4d5ad9f8f02b780', 'count()': 1},
          ],
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
        expect(mockEventsApi).toHaveBeenCalledWith(
          mockEventsUrl,
          expect.objectContaining({
            query: {
              environment: [],
              field: ['replayId', 'count()'],
              per_page: 50,
              project: ['2'],
              query: `issue.id:${mockGroup.id} !replayId:""`,
              statsPeriod: '14d',
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
                'countErrors',
                'duration',
                'finishedAt',
                'id',
                'projectId',
                'startedAt',
                'urls',
                'user',
              ],
              per_page: 50,
              project: ['2'],
              query:
                'id:[346789a703f6454384f1de473b8b9fcc,b05dae9b6be54d21a4d5ad9f8f02b780]',
              sort: '-startedAt',
              statsPeriod: '14d',
            }),
          })
        );
      });
    });

    it('should show empty message when no replays are found', async () => {
      const mockGroup = TestStubs.Group();

      const mockEventsApi = MockApiClient.addMockResponse({
        url: mockEventsUrl,
        body: {
          data: [
            {replayId: '346789a703f6454384f1de473b8b9fcc', 'count()': 1},
            {replayId: 'b05dae9b6be54d21a4d5ad9f8f02b780', 'count()': 1},
          ],
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
      expect(mockEventsApi).toHaveBeenCalledTimes(1);
      expect(mockReplayApi).toHaveBeenCalledTimes(1);
      expect(container).toSnapshot();
    });

    it('should display error message when api call fails', async () => {
      const mockGroup = TestStubs.Group();

      const mockEventsApi = MockApiClient.addMockResponse({
        url: mockEventsUrl,
        body: {
          data: [
            {replayId: '346789a703f6454384f1de473b8b9fcc', 'count()': 1},
            {replayId: 'b05dae9b6be54d21a4d5ad9f8f02b780', 'count()': 1},
          ],
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
        expect(mockEventsApi).toHaveBeenCalledTimes(1);
        expect(mockReplayApi).toHaveBeenCalledTimes(1);
        expect(
          screen.getByText('Invalid number: asdf. Expected number.')
        ).toBeInTheDocument();
      });
    });

    it('should display default error message when api call fails without a body', async () => {
      const mockGroup = TestStubs.Group();

      const mockEventsApi = MockApiClient.addMockResponse({
        url: mockEventsUrl,
        body: {
          data: [
            {replayId: '346789a703f6454384f1de473b8b9fcc', 'count()': 1},
            {replayId: 'b05dae9b6be54d21a4d5ad9f8f02b780', 'count()': 1},
          ],
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
        expect(mockEventsApi).toHaveBeenCalledTimes(1);
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

      const mockEventsApi = MockApiClient.addMockResponse({
        url: mockEventsUrl,
        body: {
          data: [
            {replayId: '346789a703f6454384f1de473b8b9fcc', 'count()': 1},
            {replayId: 'b05dae9b6be54d21a4d5ad9f8f02b780', 'count()': 1},
          ],
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
        expect(mockEventsApi).toHaveBeenCalledTimes(1);
        expect(mockReplayApi).toHaveBeenCalledTimes(1);
      });
    });

    it('should show a list of replays and have the correct values', async () => {
      const mockGroup = TestStubs.Group();

      const mockEventsApi = MockApiClient.addMockResponse({
        url: mockEventsUrl,
        body: {
          data: [
            {replayId: '346789a703f6454384f1de473b8b9fcc', 'count()': 1},
            {replayId: 'b05dae9b6be54d21a4d5ad9f8f02b780', 'count()': 1},
          ],
        },
      });

      const mockReplayApi = MockApiClient.addMockResponse({
        url: mockReplayUrl,
        statusCode: 200,
        body: {
          data: [
            {
              countErrors: 1,
              duration: 52346,
              finishedAt: '2022-09-15T06:54:00+00:00',
              id: '346789a703f6454384f1de473b8b9fcc',
              projectId: '2',
              startedAt: '2022-09-15T06:50:03+00:00',
              urls: [
                'https://dev.getsentry.net:7999/organizations/sentry-emerging-tech/replays/',
                '/organizations/sentry-emerging-tech/replays/?project=2',
              ],
              user: {
                id: '147086',
                name: '',
                email: '',
                ip_address: '127.0.0.1',
                displayName: 'testDisplayName',
              },
            },
            {
              countErrors: 4,
              duration: 400,
              finishedAt: '2022-09-21T21:40:38+00:00',
              id: 'b05dae9b6be54d21a4d5ad9f8f02b780',
              projectId: '2',
              startedAt: '2022-09-21T21:30:44+00:00',
              urls: [
                'https://dev.getsentry.net:7999/organizations/sentry-emerging-tech/replays/?project=2&statsPeriod=24h',
                '/organizations/sentry-emerging-tech/issues/',
                '/organizations/sentry-emerging-tech/issues/?project=2',
              ],
              user: {
                id: '147086',
                name: '',
                email: '',
                ip_address: '127.0.0.1',
                displayName: 'testDisplayName',
              },
            },
          ],
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
        expect(mockEventsApi).toHaveBeenCalledTimes(1);
        expect(mockReplayApi).toHaveBeenCalledTimes(1);
      });

      // Expect the table to have 2 rows
      expect(screen.getAllByText('testDisplayName')).toHaveLength(2);

      const expectedQuery =
        'query=&referrer=%2Forganizations%2F%3AorgId%2Fissues%2F%3AgroupId%2Freplays%2F&statsPeriod=14d&yAxis=count%28%29';

      // Expect the first row to have the correct href
      expect(screen.getAllByRole('link', {name: 'testDisplayName'})[0]).toHaveAttribute(
        'href',
        `/organizations/org-slug/replays/project-slug:346789a703f6454384f1de473b8b9fcc/?${expectedQuery}`
      );

      // Expect the second row to have the correct href
      expect(screen.getAllByRole('link', {name: 'testDisplayName'})[1]).toHaveAttribute(
        'href',
        `/organizations/org-slug/replays/project-slug:b05dae9b6be54d21a4d5ad9f8f02b780/?${expectedQuery}`
      );

      // Expect the first row to have the correct duration
      expect(screen.getByText('14hr 32min 26s')).toBeInTheDocument();

      // Expect the second row to have the correct duration
      expect(screen.getByText('6min 40s')).toBeInTheDocument();

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
  describe('sorting', () => {
    let mockEventsApi;
    let mockReplayApi;

    beforeEach(() => {
      mockEventsApi = MockApiClient.addMockResponse({
        url: mockEventsUrl,
        body: {
          data: [
            {replayId: '346789a703f6454384f1de473b8b9fcc', 'count()': 1},
            {replayId: 'b05dae9b6be54d21a4d5ad9f8f02b780', 'count()': 1},
          ],
        },
      });

      mockReplayApi = MockApiClient.addMockResponse({
        url: mockReplayUrl,
        body: {
          data: [],
        },
        statusCode: 200,
      });
    });

    it('should not call the events api again when sorting the visible rows', async () => {
      const mockGroup = TestStubs.Group();

      const {router, organization, routerContext} = init({});
      const {rerender} = render(<GroupReplays group={mockGroup} />, {
        context: routerContext,
        organization,
        router,
      });

      await waitFor(() => {
        expect(mockEventsApi).toHaveBeenCalledTimes(1);
        expect(mockReplayApi).toHaveBeenCalledTimes(1);
        expect(mockReplayApi).toHaveBeenLastCalledWith(
          mockReplayUrl,
          expect.objectContaining({
            query: expect.objectContaining({
              sort: '-startedAt',
            }),
          })
        );
      });

      // Change the sort order then tell react to re-render
      router.location.query.sort = 'duration';
      rerender(<GroupReplays group={mockGroup} />);

      await waitFor(() => {
        expect(mockEventsApi).toHaveBeenCalledTimes(1);
        expect(mockReplayApi).toHaveBeenCalledTimes(2);
        expect(mockReplayApi).toHaveBeenLastCalledWith(
          mockReplayUrl,
          expect.objectContaining({
            query: expect.objectContaining({
              sort: 'duration',
            }),
          })
        );
      });
    });

    it('should be able to click the `Start Time` column and request data sorted by startedAt query', async () => {
      const mockGroup = TestStubs.Group();

      const {router, organization, routerContext} = init({});
      const {rerender} = render(<GroupReplays group={mockGroup} />, {
        context: routerContext,
        organization,
        router,
      });

      await waitFor(() => {
        expect(mockReplayApi).toHaveBeenCalledTimes(1);
      });

      userEvent.click(screen.getByRole('columnheader', {name: 'Start Time'}));
      expect(routerContext.context.router.push).toHaveBeenLastCalledWith({
        pathname: '/organizations/org-slug/replays/',
        query: {
          sort: 'startedAt',
        },
      });

      // Update the location, and re-render with the new value
      router.location.query.sort = 'startedAt';
      rerender(<GroupReplays group={mockGroup} />);

      await waitFor(() => {
        expect(mockReplayApi).toHaveBeenCalledTimes(2);
      });

      userEvent.click(screen.getByRole('columnheader', {name: 'Start Time'}));
      expect(routerContext.context.router.push).toHaveBeenLastCalledWith({
        pathname: '/organizations/org-slug/replays/',
        query: {
          sort: '-startedAt',
        },
      });
    });

    it('should be able to click the `Duration` column and request data sorted by duration query', async () => {
      const mockGroup = TestStubs.Group();

      const {router, organization, routerContext} = init({});
      const {rerender} = render(<GroupReplays group={mockGroup} />, {
        context: routerContext,
        organization,
        router,
      });

      await waitFor(() => {
        expect(mockReplayApi).toHaveBeenCalledTimes(1);
      });

      userEvent.click(screen.getByRole('columnheader', {name: 'Duration'}));
      expect(routerContext.context.router.push).toHaveBeenLastCalledWith({
        pathname: '/organizations/org-slug/replays/',
        query: {
          sort: '-duration',
        },
      });

      // Update the location, and re-render with the new value
      router.location.query.sort = '-duration';
      rerender(<GroupReplays group={mockGroup} />);

      await waitFor(() => {
        expect(mockReplayApi).toHaveBeenCalledTimes(2);
      });

      userEvent.click(screen.getByRole('columnheader', {name: 'Duration'}));
      expect(routerContext.context.router.push).toHaveBeenLastCalledWith({
        pathname: '/organizations/org-slug/replays/',
        query: {
          sort: 'duration',
        },
      });
    });

    it('should be able to click the `Errors` column and request data sorted by countErrors query', async () => {
      const mockGroup = TestStubs.Group();

      const {router, organization, routerContext} = init({});
      const {rerender} = render(<GroupReplays group={mockGroup} />, {
        context: routerContext,
        organization,
        router,
      });

      await waitFor(() => {
        expect(mockReplayApi).toHaveBeenCalledTimes(1);
      });

      userEvent.click(screen.getByRole('columnheader', {name: 'Errors'}));
      expect(routerContext.context.router.push).toHaveBeenLastCalledWith({
        pathname: '/organizations/org-slug/replays/',
        query: {
          sort: '-countErrors',
        },
      });

      // Update the location, and re-render with the new value
      router.location.query.sort = '-countErrors';
      rerender(<GroupReplays group={mockGroup} />);

      await waitFor(() => {
        expect(mockReplayApi).toHaveBeenCalledTimes(2);
      });

      userEvent.click(screen.getByRole('columnheader', {name: 'Errors'}));
      expect(routerContext.context.router.push).toHaveBeenLastCalledWith({
        pathname: '/organizations/org-slug/replays/',
        query: {
          sort: 'countErrors',
        },
      });
    });

    it('should be able to click the `Activity` column and request data sorted by startedAt query', async () => {
      const mockGroup = TestStubs.Group();

      const {router, organization, routerContext} = init({});
      const {rerender} = render(<GroupReplays group={mockGroup} />, {
        context: routerContext,
        organization,
        router,
      });

      await waitFor(() => {
        expect(mockReplayApi).toHaveBeenCalledTimes(1);
      });

      userEvent.click(screen.getByRole('columnheader', {name: 'Activity'}));
      expect(routerContext.context.router.push).toHaveBeenLastCalledWith({
        pathname: '/organizations/org-slug/replays/',
        query: {
          sort: '-activity',
        },
      });

      // Update the location, and re-render with the new value
      router.location.query.sort = '-activity';
      rerender(<GroupReplays group={mockGroup} />);

      await waitFor(() => {
        expect(mockReplayApi).toHaveBeenCalledTimes(2);
      });

      userEvent.click(screen.getByRole('columnheader', {name: 'Activity'}));
      expect(routerContext.context.router.push).toHaveBeenLastCalledWith({
        pathname: '/organizations/org-slug/replays/',
        query: {
          sort: 'activity',
        },
      });
    });
  });
});
