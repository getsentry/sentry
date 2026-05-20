import {DetailedEventsFixture} from 'sentry-fixture/events';
import {GroupFixture} from 'sentry-fixture/group';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {GroupMergedView} from 'sentry/views/issueDetails/groupMerged';

describe('Issues -> Merged View', () => {
  const events = DetailedEventsFixture();
  const group = GroupFixture();
  const mergedFingerprints = [
    {
      latestEvent: events[0],
      id: '2c4887696f708c476a81ce4e834c4b02',
      mergedBySeer: true,
    },
    {
      latestEvent: events[1],
      id: 'e05da55328a860b21f62e371f0a7507d',
    },
  ];

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/hashes/`,
      body: mergedFingerprints,
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

    const links = await screen.findAllByRole('button', {name: 'View latest event'});
    expect(links).toHaveLength(mergedFingerprints.length);

    const title = await screen.findByText('Fingerprints included in this issue');
    expect(title.parentElement).toHaveTextContent(
      'Fingerprints included in this issue (2)'
    );
  });
});
