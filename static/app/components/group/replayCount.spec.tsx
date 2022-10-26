import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import GroupReplayCount from 'sentry/components/group/replayCount';

describe('GroupReplayCount', function () {
  const organization = TestStubs.Organization();

  it('does not render when a group has no replays', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        meta: {},
        data: [],
      },
    });

    const {container} = render(
      <GroupReplayCount groupId="123" orgId={organization.slug} />
    );

    expect(screen.getByTestId('loading-placeholder')).toBeInTheDocument();

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it('renders the correct replay count', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        meta: {},
        data: [
          {
            id: '123',
            'count()': 1,
          },
          {
            id: '456',
            'count()': 2,
          },
        ],
      },
    });

    const {container} = render(
      <GroupReplayCount groupId="123" orgId={organization.slug} />
    );

    expect(screen.getByTestId('loading-placeholder')).toBeInTheDocument();

    await waitFor(() => {
      expect(container).not.toBeEmptyDOMElement();
      expect(screen.getByTestId('replay-count')).toHaveTextContent('2');
    });
  });
});
