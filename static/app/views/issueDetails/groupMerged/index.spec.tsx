import {DetailedEventsFixture} from 'sentry-fixture/events';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  act,
  render,
  screen,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import GroupingStore from 'sentry/stores/groupingStore';
import {GroupMergedView} from 'sentry/views/issueDetails/groupMerged';

jest.mock('sentry/api');

describe('Issues -> Merged View', function () {
  const events = DetailedEventsFixture();
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

  beforeEach(function () {
    GroupingStore.init();
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/groupId/hashes/?limit=50&query=',
      body: mockData.merged,
    });
  });

  it('renders initially with loading component', async function () {
    const {organization, project, router} = initializeOrg({
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
      />,
      {router}
    );

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    await act(tick);
  });

  it('renders with mocked data', async function () {
    const {organization, project, router} = initializeOrg({
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
      />,
      {router}
    );

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));
  });
});
