import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import GroupingStore from 'sentry/stores/groupingStore';
import {GroupMergedView} from 'sentry/views/issueDetails/groupMerged';

jest.mock('sentry/api');

describe('Issues -> Merged View', function () {
  const events = TestStubs.DetailedEvents();
  const mockData = {
    merged: [
      {
        latestEvent: events[0],
        state: 'unlocked',
        id: '2c4887696f708c476a81ce4e834c4b02',
      },
      {
        latestEvent: events[1],
        state: 'unlocked',
        id: 'e05da55328a860b21f62e371f0a7507d',
      },
    ],
  };

  beforeAll(function () {
    MockApiClient.addMockResponse({
      url: '/issues/groupId/hashes/?limit=50&query=',
      body: mockData.merged,
    });
  });

  beforeEach(() => {
    GroupingStore.init();
  });

  it('renders initially with loading component', function () {
    const {organization, project, router, routerContext} = initializeOrg({
      project: {
        slug: 'projectId',
      },
      router: {
        location: {
          query: {},
        },
      },
    });

    render(
      <GroupMergedView
        organization={organization}
        project={project}
        params={{orgId: 'orgId', groupId: 'groupId'}}
        location={router.location}
        routeParams={{}}
        route={{}}
        routes={router.routes}
        router={router}
      />,
      {context: routerContext}
    );

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('renders with mocked data', async function () {
    const {organization, project, router, routerContext} = initializeOrg({
      project: {
        slug: 'projectId',
      },
      router: {
        location: {
          query: {},
        },
      },
    });

    const {container} = render(
      <GroupMergedView
        organization={organization}
        project={project}
        params={{orgId: 'orgId', groupId: 'groupId'}}
        location={router.location}
        routeParams={{}}
        route={{}}
        routes={router.routes}
        router={router}
      />,
      {context: routerContext}
    );

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    expect(container).toSnapshot();
  });
});
