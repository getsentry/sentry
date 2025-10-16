import {DetailedEventsFixture} from 'sentry-fixture/events';
import {GroupFixture} from 'sentry-fixture/group';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import GroupingStore from 'sentry/stores/groupingStore';
import GroupMergedView from 'sentry/views/issueDetails/groupMerged';

describe('Issues -> Merged View', () => {
  const events = DetailedEventsFixture();
  const group = GroupFixture();
  const mockData = {
    merged: [
      {
        latestEvent: events[0],
        state: 'unlocked',
        id: '2c4887696f708c476a81ce4e834c4b02',
        mergedBySeer: true,
      },
      {
        latestEvent: events[1],
        state: 'unlocked',
        id: 'e05da55328a860b21f62e371f0a7507d',
      },
    ],
  };

  beforeEach(() => {
    GroupingStore.init();
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/hashes/?limit=50&query=`,
      body: mockData.merged,
    });
  });

  it('renders merged groups', async () => {
    const {organization, project, router} = initializeOrg({
      router: {
        params: {groupId: 'groupId'},
      },
    });

    render(
      <GroupMergedView project={project} groupId={group.id} location={router.location} />,
      {
        organization,
      }
    );

    // Wait for the component to load
    await screen.findByText('Fingerprints included in this issue');

    const title = await screen.findByText('Fingerprints included in this issue');
    expect(title.parentElement).toHaveTextContent(
      'Fingerprints included in this issue (2)'
    );

    const links = await screen.findAllByRole('button', {name: 'View latest event'});
    expect(links).toHaveLength(mockData.merged.length);
  });
});
