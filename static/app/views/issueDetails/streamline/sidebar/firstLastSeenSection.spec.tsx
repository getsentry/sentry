import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ReleaseFixture} from 'sentry-fixture/release';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import FirstLastSeenSection from 'sentry/views/issueDetails/streamline/sidebar/firstLastSeenSection';

describe('FirstLastSeenSection', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const group = GroupFixture({
    project,
    firstSeen: '2024-01-06T10:00:00Z',
    lastSeen: '2024-01-14T12:00:00Z',
  });

  const firstRelease = ReleaseFixture({version: '1.0.0'});
  const lastRelease = ReleaseFixture({version: '1.1.0'});

  let mockFirstLastRelease: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    MockApiClient.clearMockResponses();

    mockFirstLastRelease = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/first-last-release/`,
      method: 'GET',
      body: {
        id: group.id,
        firstRelease,
        lastRelease,
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      method: 'GET',
      body: GroupFixture({
        id: group.id,
        firstSeen: '2024-01-06T10:00:00Z',
        lastSeen: '2024-01-14T12:00:00Z',
      }),
    });
  });

  it('renders first and last seen information with release data', async () => {
    render(<FirstLastSeenSection group={group} />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/issues/${group.id}/`,
          query: {},
        },
      },
    });

    await waitFor(() => {
      expect(mockFirstLastRelease).toHaveBeenCalled();
    });

    expect(mockFirstLastRelease).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/issues/${group.id}/first-last-release/`,
      expect.objectContaining({query: undefined})
    );

    expect(await screen.findByText('First seen')).toBeInTheDocument();
    expect(screen.getByText('Last seen')).toBeInTheDocument();

    expect(
      screen.getByText(textWithMarkupMatcher('in release 1.0.0'))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher('in release 1.1.0'))
    ).toBeInTheDocument();
  });

  it('calls API with environment parameters when environments are selected', async () => {
    render(<FirstLastSeenSection group={group} />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/issues/${group.id}/`,
          query: {environment: ['production', 'staging']},
        },
      },
    });

    await waitFor(() => {
      expect(mockFirstLastRelease).toHaveBeenCalled();
    });

    expect(mockFirstLastRelease).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/issues/${group.id}/first-last-release/`,
      expect.objectContaining({
        query: {
          environment: ['production', 'staging'],
        },
      })
    );
  });

  it('shows environment-specific release information', async () => {
    const productionRelease = ReleaseFixture({version: '1.0.0'});

    mockFirstLastRelease = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/first-last-release/`,
      method: 'GET',
      body: {
        id: group.id,
        firstRelease: productionRelease,
        lastRelease: productionRelease,
      },
    });

    render(<FirstLastSeenSection group={group} />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/issues/${group.id}/`,
          query: {environment: ['production']},
        },
      },
    });

    const releaseTexts = await screen.findAllByText(
      textWithMarkupMatcher('in release 1.0.0')
    );
    expect(releaseTexts).toHaveLength(2);
  });

  it('handles missing release data gracefully', async () => {
    mockFirstLastRelease = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/first-last-release/`,
      method: 'GET',
      body: {
        id: group.id,
        firstRelease: null,
        lastRelease: null,
      },
    });

    render(<FirstLastSeenSection group={group} />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/issues/${group.id}/`,
          query: {},
        },
      },
    });

    expect(await screen.findByText('First seen')).toBeInTheDocument();
    expect(screen.getByText('Last seen')).toBeInTheDocument();
    expect(screen.queryByText(/in release/)).not.toBeInTheDocument();
  });
});
