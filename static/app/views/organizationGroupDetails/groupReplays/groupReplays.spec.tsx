import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {OrganizationContext} from 'sentry/views/organizationContext';
import GroupReplays from 'sentry/views/organizationGroupDetails/groupReplays';
import {RouteContext} from 'sentry/views/routeContext';

const mockUrl = '/organizations/org-slug/replays/';

const mockProps = {
  group: TestStubs.Group(),
  replayIds: ['346789a703f6454384f1de473b8b9fcc', 'b05dae9b6be54d21a4d5ad9f8f02b780'],
};

let mockRouterContext: any = {};

const getComponent = ({
  location,
  features = ['session-replay-ui'],
}: {
  features?: string[];
  location?: {
    pathname?: string;
    query?: {[key: string]: string};
  };
}) => {
  const {router, organization, routerContext} = initializeOrg({
    organization: {
      features,
    },
    project: TestStubs.Project(),
    projects: [TestStubs.Project()],
    router: {
      location: {
        pathname: '/organizations/org-slug/replays/',
        query: {},
        ...location,
      },
    },
  });

  ProjectsStore.init();
  ProjectsStore.loadInitialData(organization.projects);

  mockRouterContext = routerContext;

  return (
    <OrganizationContext.Provider value={organization}>
      <RouteContext.Provider
        value={{
          router,
          location: router.location,
          params: router.params,
          routes: [],
        }}
      >
        <GroupReplays {...mockProps} />
      </RouteContext.Provider>
    </OrganizationContext.Provider>
  );
};

const renderComponent = () => {
  return render(getComponent({}), {context: mockRouterContext});
};

describe('GroupReplays', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  // Assert that query to the events endpoint is correct
  it('Should have correct queries in the events endpoint', async () => {
    const mockApi = MockApiClient.addMockResponse({
      url: mockUrl,
      body: {
        data: [],
      },
      statusCode: 200,
    });

    renderComponent();

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledTimes(1);
      // Expect api path to have the correct query params
      expect(mockApi).toHaveBeenCalledWith(
        mockUrl,
        expect.objectContaining({
          query: expect.objectContaining({
            statsPeriod: '14d',
            project: ['2'],
            environment: [],
            field: [
              'countErrors',
              'duration',
              'finishedAt',
              'id',
              'projectId',
              'startedAt',
              'urls',
              'user',
            ],
            sort: '-startedAt',
            per_page: 50,
            query:
              'id:[346789a703f6454384f1de473b8b9fcc,b05dae9b6be54d21a4d5ad9f8f02b780]',
          }),
        })
      );
    });
  });

  it('Should snapshot empty state', async () => {
    MockApiClient.addMockResponse({
      url: mockUrl,
      body: {
        data: [],
      },
      statusCode: 200,
    });

    const {container} = renderComponent();

    await waitFor(() => {
      expect(container).toSnapshot();
    });
  });

  it('Should show empty message when no replays are found', async () => {
    const mockApi = MockApiClient.addMockResponse({
      url: mockUrl,
      body: {
        data: [],
      },
      statusCode: 200,
    });

    renderComponent();

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledTimes(1);
      expect(screen.getByText('There are no items to display')).toBeInTheDocument();
    });
  });

  it('Should display error message when api call fails', async () => {
    const mockApi = MockApiClient.addMockResponse({
      url: mockUrl,
      statusCode: 500,
      body: {},
    });

    renderComponent();

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledTimes(1);
      expect(
        screen.getByText(
          'Sorry, the list of replays could not be loaded. This could be due to invalid search parameters or an internal systems error.'
        )
      ).toBeInTheDocument();
    });
  });

  it('Should show loading indicator when loading replays', async () => {
    const mockApi = MockApiClient.addMockResponse({
      url: mockUrl,
      statusCode: 200,
      body: {
        data: [],
      },
    });

    renderComponent();

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledTimes(1);
    });
  });

  it('Should show a list of replays and have the correct values', async () => {
    const mockApi = MockApiClient.addMockResponse({
      url: mockUrl,
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

    jest.useFakeTimers().setSystemTime(new Date('Sep 28, 2022 11:29:13 PM UTC'));

    renderComponent();

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledTimes(1);
    });

    // Expect the table to have 2 rows
    expect(screen.getAllByText('testDisplayName')).toHaveLength(2);

    // Expect the first row to have the correct href
    expect(screen.getAllByRole('link', {name: 'testDisplayName'})[0]).toHaveAttribute(
      'href',
      '/organizations/org-slug/replays/project-slug:346789a703f6454384f1de473b8b9fcc/?referrer='
    );

    // Expect the second row to have the correct href
    expect(screen.getAllByRole('link', {name: 'testDisplayName'})[1]).toHaveAttribute(
      'href',
      '/organizations/org-slug/replays/project-slug:b05dae9b6be54d21a4d5ad9f8f02b780/?referrer='
    );

    // Expect the first row to have the correct duration
    expect(screen.getByText('14hr 32min 26s')).toBeInTheDocument();

    // Expect the second row to have the correct duration
    expect(screen.getByText('6min 40s')).toBeInTheDocument();

    // Expect the first row to have the correct errors
    expect(screen.getByText('1')).toBeInTheDocument();

    // Expect the second row to have the correct errors
    expect(screen.getByText('4')).toBeInTheDocument();

    // Expect the first row to have the correct date
    expect(screen.getByText('14 days ago')).toBeInTheDocument();

    // Expect the second row to have the correct date
    expect(screen.getByText('7 days ago')).toBeInTheDocument();
  });

  it('Should sort by start time correctly', async () => {
    const mockApi = MockApiClient.addMockResponse({
      url: mockUrl,
      body: {
        data: [],
      },
      statusCode: 200,
    });

    const {rerender} = renderComponent();

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith(
        mockUrl,
        expect.objectContaining({
          query: expect.objectContaining({
            sort: '-startedAt',
          }),
        })
      );
    });

    // Click on the start time header and expect the sort to be startedAt
    userEvent.click(screen.getByRole('columnheader', {name: 'Start Time'}));

    expect(mockRouterContext.context.router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/replays/',
      query: {
        sort: 'startedAt',
      },
    });

    // Need to simulate a rerender to get the new sort
    rerender(
      getComponent({
        location: {
          query: {
            sort: 'startedAt',
          },
        },
      })
    );

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledTimes(2);
      expect(mockApi).toHaveBeenCalledWith(
        mockUrl,
        expect.objectContaining({
          query: expect.objectContaining({
            sort: 'startedAt',
          }),
        })
      );
    });
  });

  it('Should sort by duration correctly', async () => {
    const mockApi = MockApiClient.addMockResponse({
      url: mockUrl,
      body: {
        data: [],
      },
      statusCode: 200,
    });

    const {rerender} = renderComponent();

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith(
        mockUrl,
        expect.objectContaining({
          query: expect.objectContaining({
            sort: '-startedAt',
          }),
        })
      );
    });

    // Click on the duration header and expect the sort to be duration
    userEvent.click(screen.getByRole('columnheader', {name: 'Duration'}));

    expect(mockRouterContext.context.router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/replays/',
      query: {
        sort: 'duration',
      },
    });

    // Need to simulate a rerender to get the new sort
    rerender(
      getComponent({
        location: {
          query: {
            sort: 'duration',
          },
        },
      })
    );

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledTimes(2);
      expect(mockApi).toHaveBeenCalledWith(
        mockUrl,
        expect.objectContaining({
          query: expect.objectContaining({
            sort: 'duration',
          }),
        })
      );
    });
  });

  it('Should sort by errors correctly', async () => {
    const mockApi = MockApiClient.addMockResponse({
      url: mockUrl,
      body: {
        data: [],
      },
      statusCode: 200,
    });

    const {rerender} = renderComponent();

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith(
        mockUrl,
        expect.objectContaining({
          query: expect.objectContaining({
            sort: '-startedAt',
          }),
        })
      );
    });

    // Click on the errors header and expect the sort to be countErrors
    userEvent.click(screen.getByRole('columnheader', {name: 'Errors'}));

    expect(mockRouterContext.context.router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/replays/',
      query: {
        sort: 'countErrors',
      },
    });

    // Need to simulate a rerender to get the new sort
    rerender(
      getComponent({
        location: {
          query: {
            sort: 'countErrors',
          },
        },
      })
    );

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledTimes(2);
      expect(mockApi).toHaveBeenCalledWith(
        mockUrl,
        expect.objectContaining({
          query: expect.objectContaining({
            sort: 'countErrors',
          }),
        })
      );
    });
  });
});
