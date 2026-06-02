import {DetailedEventsFixture} from 'sentry-fixture/events';
import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {GroupMergedView} from 'sentry/views/issueDetails/groupMerged';

describe('GroupMergedView', () => {
  const events = DetailedEventsFixture();
  const group = GroupFixture();
  const project = ProjectFixture();
  const hashesUrl = `/organizations/org-slug/issues/${group.id}/hashes/`;
  const pageLinks =
    '<http://localhost/api/0/issues/1/hashes/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1", ' +
    '<http://localhost/api/0/issues/1/hashes/?cursor=0:50:0>; rel="next"; results="false"; cursor="0:50:0"';
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
  });

  it('renders merged groups', async () => {
    MockApiClient.addMockResponse({
      url: hashesUrl,
      body: mergedFingerprints,
      headers: {Link: pageLinks},
    });

    render(<GroupMergedView project={project} groupId={group.id} />);

    const links = await screen.findAllByRole('link', {name: 'Latest event'});
    expect(links).toHaveLength(mergedFingerprints.length);
    expect(links[0]).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/268/events/904/?project=1&referrer=merged-item'
    );
    const showFingerprint = screen.getByRole('button', {
      name: `Show ${mergedFingerprints[0]!.id} fingerprints`,
    });

    const title = await screen.findByText('Fingerprints included in this issue');
    expect(title).toBeInTheDocument();
    expect(screen.getByText(/Merged by Sentry/)).toBeInTheDocument();
    expect(screen.queryByText(mergedFingerprints[0]!.id)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: `Copy fingerprint ${mergedFingerprints[0]!.id} to clipboard`,
      })
    ).not.toBeInTheDocument();

    await userEvent.click(showFingerprint);

    expect(
      await screen.findByText(`Fingerprint ${mergedFingerprints[0]!.id}`)
    ).toBeInTheDocument();
  });
});
