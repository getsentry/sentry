import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {RevisionListItem} from './revisionListItem';

const SNAPSHOT_URL = '/organizations/org-slug/dashboards/1/revisions/1/';
const BASE_SNAPSHOT_URL = '/organizations/org-slug/dashboards/1/revisions/2/';

function makeSnapshot(overrides = {}) {
  return {
    id: '1',
    title: 'My Dashboard',
    dateCreated: '2024-01-15T10:00:00Z',
    widgets: [],
    filters: {},
    projects: [],
    ...overrides,
  };
}

function renderItem(props: Partial<React.ComponentProps<typeof RevisionListItem>> = {}) {
  const organization = OrganizationFixture();
  const defaults: React.ComponentProps<typeof RevisionListItem> = {
    dashboardId: '1',
    isSelected: false,
    onSelect: jest.fn(),
    revisionSource: 'edit',
    createdBy: {id: '42', name: 'Alice', email: 'alice@example.com'},
    dateCreated: '2024-01-15T10:00:00Z',
    baseRevisionId: '2',
    revisionId: '1',
  };
  render(<RevisionListItem {...defaults} {...props} />, {organization});
}

describe('RevisionListItem', () => {
  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('shows a loading indicator while fetching revision details', () => {
    // Never resolves — stays in pending state
    MockApiClient.addMockResponse({url: SNAPSHOT_URL, body: makeSnapshot()});
    MockApiClient.addMockResponse({url: BASE_SNAPSHOT_URL, body: makeSnapshot()});

    renderItem();

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('shows an error when the revision details request fails', async () => {
    MockApiClient.addMockResponse({url: SNAPSHOT_URL, statusCode: 500, body: {}});
    MockApiClient.addMockResponse({url: BASE_SNAPSHOT_URL, body: makeSnapshot()});

    renderItem();

    expect(
      await screen.findByText('Failed to load revision preview.')
    ).toBeInTheDocument();
  });

  it('shows an error when the base revision details request fails', async () => {
    MockApiClient.addMockResponse({url: SNAPSHOT_URL, body: makeSnapshot()});
    MockApiClient.addMockResponse({url: BASE_SNAPSHOT_URL, statusCode: 500, body: {}});

    renderItem();

    expect(
      await screen.findByText('Failed to load revision preview.')
    ).toBeInTheDocument();
  });

  it('shows the oldest-revision message when there is no base revision', async () => {
    MockApiClient.addMockResponse({url: SNAPSHOT_URL, body: makeSnapshot()});

    renderItem({baseRevisionId: null});

    expect(
      await screen.findByText(
        'This is the oldest revision — no previous state to compare against.'
      )
    ).toBeInTheDocument();
  });

  it('uses snapshotOverride without making an API call for the snapshot', async () => {
    const snapshotRequest = MockApiClient.addMockResponse({
      url: SNAPSHOT_URL,
      body: makeSnapshot(),
    });
    MockApiClient.addMockResponse({url: BASE_SNAPSHOT_URL, body: makeSnapshot()});

    renderItem({snapshotOverride: makeSnapshot() as any});

    await screen.findByText('No widget changes in this revision.');
    expect(snapshotRequest).not.toHaveBeenCalled();
  });

  it('shows "Current Version" in accent when isCurrentVersion is true', () => {
    MockApiClient.addMockResponse({url: BASE_SNAPSHOT_URL, body: makeSnapshot()});

    renderItem({
      isCurrentVersion: true,
      revisionId: undefined,
      snapshotOverride: makeSnapshot() as any,
    });

    expect(screen.getByText('Current Version')).toBeInTheDocument();
  });

  it('shows the author name', async () => {
    MockApiClient.addMockResponse({url: SNAPSHOT_URL, body: makeSnapshot()});
    MockApiClient.addMockResponse({url: BASE_SNAPSHOT_URL, body: makeSnapshot()});

    renderItem();

    expect(await screen.findByText('Alice')).toBeInTheDocument();
  });

  it('falls back to email when the author has no name', async () => {
    MockApiClient.addMockResponse({url: SNAPSHOT_URL, body: makeSnapshot()});
    MockApiClient.addMockResponse({url: BASE_SNAPSHOT_URL, body: makeSnapshot()});

    renderItem({createdBy: {id: '42', name: '', email: 'alice@example.com'}});

    expect(await screen.findByText('alice@example.com')).toBeInTheDocument();
  });

  it('renders the avatar image when avatarUrl is provided', async () => {
    MockApiClient.addMockResponse({url: SNAPSHOT_URL, body: makeSnapshot()});
    MockApiClient.addMockResponse({url: BASE_SNAPSHOT_URL, body: makeSnapshot()});

    const avatarUrl = 'https://example.com/avatar.jpg';
    renderItem({
      createdBy: {
        id: '42',
        name: 'Alice',
        email: 'alice@example.com',
        avatar: {avatarType: 'upload', avatarUrl, avatarUuid: null},
      },
    });

    expect(await screen.findByRole('img', {name: 'Alice'})).toHaveAttribute(
      'src',
      expect.stringContaining(avatarUrl)
    );
  });

  it('renders a gravatar avatar container when avatarType is gravatar', () => {
    MockApiClient.addMockResponse({url: SNAPSHOT_URL, body: makeSnapshot()});
    MockApiClient.addMockResponse({url: BASE_SNAPSHOT_URL, body: makeSnapshot()});

    renderItem({
      createdBy: {
        id: '42',
        name: 'Alice',
        email: 'alice@example.com',
        avatar: {avatarType: 'gravatar', avatarUrl: null, avatarUuid: null},
      },
    });

    expect(screen.getByTestId('gravatar-avatar')).toBeInTheDocument();
  });

  it('shows "Unknown" when createdBy is null', async () => {
    MockApiClient.addMockResponse({url: SNAPSHOT_URL, body: makeSnapshot()});
    MockApiClient.addMockResponse({url: BASE_SNAPSHOT_URL, body: makeSnapshot()});

    renderItem({createdBy: null});

    expect(await screen.findByText('Unknown')).toBeInTheDocument();
  });

  it('shows a widget diff for added widgets', async () => {
    MockApiClient.addMockResponse({
      url: SNAPSHOT_URL,
      body: makeSnapshot({
        widgets: [
          {
            id: '10',
            title: 'New Widget',
            displayType: 'line',
            queries: [],
            interval: '1h',
          },
        ],
      }),
    });
    MockApiClient.addMockResponse({url: BASE_SNAPSHOT_URL, body: makeSnapshot()});

    renderItem();

    expect(await screen.findByText('New Widget')).toBeInTheDocument();
    expect(screen.getByText('Added')).toBeInTheDocument();
  });
});
