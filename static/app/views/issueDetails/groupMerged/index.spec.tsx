import {DetailedEventsFixture} from 'sentry-fixture/events';
import {GroupFixture} from 'sentry-fixture/group';
import {LocationFixture} from 'sentry-fixture/locationFixture';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {GroupMergedView} from 'sentry/views/issueDetails/groupMerged';

describe('Issues -> Merged View', () => {
  const events = DetailedEventsFixture();
  const group = GroupFixture();
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
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/hashes/`,
      body: mergedFingerprints,
      headers: {Link: pageLinks},
    });
  });

  it('renders merged groups', async () => {
    const {organization, project} = initializeOrg({
      router: {
        params: {groupId: 'groupId'},
      },
    });

    render(
      <GroupMergedView
        project={project}
        groupId={group.id}
        location={LocationFixture({
          query: {
            cursor: 'abc',
            environment: 'production',
            project: '2',
            referrer: 'current-view',
            sort: 'date',
          },
        })}
      />,
      {
        organization,
      }
    );

    const links = await screen.findAllByRole('link', {name: 'Latest event'});
    expect(links).toHaveLength(mergedFingerprints.length);
    expect(links[0]).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/268/events/904/?project=1&referrer=merged-item'
    );

    const title = await screen.findByText('Fingerprints included in this issue');
    expect(title).toBeInTheDocument();
    expect(screen.getByTestId('pagination')).toHaveTextContent('2 of 2');
  });

  it('uses the absolute offset cursor for the pagination caption', async () => {
    const {organization, project} = initializeOrg({
      router: {
        params: {groupId: 'groupId'},
      },
    });

    render(
      <GroupMergedView
        project={project}
        groupId={group.id}
        location={LocationFixture({
          query: {
            cursor: '0:50:0',
          },
        })}
      />,
      {
        organization,
      }
    );

    expect(await screen.findByTestId('pagination')).toHaveTextContent('52 of 52');
  });

  it('renders fingerprints collapsed below their latest event row', async () => {
    const {organization, project} = initializeOrg({
      router: {
        params: {groupId: 'groupId'},
      },
    });

    render(
      <GroupMergedView
        project={project}
        groupId={group.id}
        location={LocationFixture()}
      />,
      {
        organization,
      }
    );

    const latestEventLinks = await screen.findAllByRole('link', {
      name: 'Latest event',
    });
    const fingerprintCheckbox = screen.getByRole('checkbox', {
      name: `Select fingerprint ${mergedFingerprints[0]!.id}`,
    });
    const showFingerprint = screen.getByRole('button', {
      name: `Show ${mergedFingerprints[0]!.id} fingerprints`,
    });

    expect(screen.getByText(/Merged by Sentry/)).toBeInTheDocument();
    expect(screen.queryByText(mergedFingerprints[0]!.id)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: `Copy fingerprint ${mergedFingerprints[0]!.id} to clipboard`,
      })
    ).not.toBeInTheDocument();

    await userEvent.click(showFingerprint);

    const fingerprint = screen.getByText(`Fingerprint ${mergedFingerprints[0]!.id}`);
    expect(latestEventLinks[0]!.compareDocumentPosition(fingerprint)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(fingerprintCheckbox.compareDocumentPosition(fingerprint)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });
});
