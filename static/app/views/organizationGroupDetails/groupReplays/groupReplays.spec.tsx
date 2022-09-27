import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {OrganizationContext} from 'sentry/views/organizationContext';
import GroupReplays from 'sentry/views/organizationGroupDetails/groupReplays';
import {RouteContext} from 'sentry/views/routeContext';

const mockUrl = '/organizations/org-slug/replays/';

const mockProps = {
  group: TestStubs.Group(),
  replayIds: [
    'af38152f74bc45b69e0df72ab5ca361c',
    '270398ab217c417083efba783af4ed89',
    '9f72f2ace52b4b0391e5fe1cd5c0cf7e',
    '50e686b7c30b43599055a642bf025d44',
    '21a580952fe84cf3a114dcaec790208d',
    '43cdb7d6c7444bb49e5ea4ccc5b928c4',
    '79b5aa62ce4c488f917ee4de46295f7f',
    '2cf3c5e24e3547ae9e32901d38a572bb',
    'e921fda7f9fd4cd99d1af6e74bbb78c8',
    '8074687b4aee4af5ac8e3ff57bee5b75',
    '4c17f20b228a454eaf594a14c26d6b94',
    '237c63507f46411aaa9becf444c1d30c',
  ],
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
    project: undefined,
    projects: undefined,
    router: {
      location: {
        pathname: '/organizations/org-slug/replays/',
        query: {},
        ...location,
      },
    },
  });

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
    const mockApiCall = MockApiClient.addMockResponse({
      url: mockUrl,
      body: [],
    });

    renderComponent();

    await waitFor(() => {
      expect(mockApiCall).toHaveBeenCalledTimes(1);
      // Expect api path to have the correct query params
      expect(mockApiCall).toHaveBeenCalledWith(
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
              'id:[af38152f74bc45b69e0df72ab5ca361c,270398ab217c417083efba783af4ed89,9f72f2ace52b4b0391e5fe1cd5c0cf7e,50e686b7c30b43599055a642bf025d44,21a580952fe84cf3a114dcaec790208d,43cdb7d6c7444bb49e5ea4ccc5b928c4,79b5aa62ce4c488f917ee4de46295f7f,2cf3c5e24e3547ae9e32901d38a572bb,e921fda7f9fd4cd99d1af6e74bbb78c8,8074687b4aee4af5ac8e3ff57bee5b75,4c17f20b228a454eaf594a14c26d6b94,237c63507f46411aaa9becf444c1d30c]',
          }),
        })
      );
    });
  });

  it('Should snapshot empty state correctly', async () => {
    MockApiClient.addMockResponse({
      url: mockUrl,
      body: [],
    });

    const {container} = renderComponent();

    await waitFor(() => {
      expect(container).toSnapshot();
    });
  });

  it('Should sort by start time correctly', async () => {
    const mockApiCall = MockApiClient.addMockResponse({
      url: mockUrl,
      body: [],
    });

    const {rerender} = renderComponent();

    await waitFor(() => {
      expect(mockApiCall).toHaveBeenCalledWith(
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
      expect(mockApiCall).toHaveBeenCalledTimes(2);
      expect(mockApiCall).toHaveBeenCalledWith(
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
    const mockApiCall = MockApiClient.addMockResponse({
      url: mockUrl,
      body: [],
    });

    const {rerender} = renderComponent();

    await waitFor(() => {
      expect(mockApiCall).toHaveBeenCalledWith(
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
      expect(mockApiCall).toHaveBeenCalledTimes(2);
      expect(mockApiCall).toHaveBeenCalledWith(
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
    const mockApiCall = MockApiClient.addMockResponse({
      url: mockUrl,
      body: [],
    });

    const {rerender} = renderComponent();

    await waitFor(() => {
      expect(mockApiCall).toHaveBeenCalledWith(
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
      expect(mockApiCall).toHaveBeenCalledTimes(2);
      expect(mockApiCall).toHaveBeenCalledWith(
        mockUrl,
        expect.objectContaining({
          query: expect.objectContaining({
            sort: 'countErrors',
          }),
        })
      );
    });

    userEvent.click(screen.getByRole('columnheader', {name: 'Errors'}));
    // TODO: Check why it fails to call the api
    expect(mockRouterContext.context.router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/replays/',
      query: {
        sort: '-countErrors',
      },
    });
  });

  it('Should show empty message when no replays are found', async () => {
    MockApiClient.addMockResponse({
      url: mockUrl,
      body: [],
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('There are no items to display')).toBeInTheDocument();
    });
  });
});
