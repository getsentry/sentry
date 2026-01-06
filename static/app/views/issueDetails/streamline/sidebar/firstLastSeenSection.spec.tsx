import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ReleaseFixture} from 'sentry-fixture/release';

import {render, screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import FirstLastSeenSection from 'sentry/views/issueDetails/streamline/sidebar/firstLastSeenSection';

describe('FirstLastSeenSection', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();

  const firstRelease = ReleaseFixture({version: '1.0.0'});
  const lastRelease = ReleaseFixture({version: '1.1.0'});

  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
  });

  it('renders first and last seen information with release data', async () => {
    const group = GroupFixture({
      project,
      firstSeen: '2024-01-06T10:00:00Z',
      lastSeen: '2024-01-14T12:00:00Z',
      firstRelease,
      lastRelease,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      method: 'GET',
      body: group,
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

    expect(
      screen.getByText(textWithMarkupMatcher('in release 1.0.0'))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher('in release 1.1.0'))
    ).toBeInTheDocument();
  });

  it('shows same release for first and last seen', async () => {
    const sameRelease = ReleaseFixture({version: '1.0.0'});
    const group = GroupFixture({
      project,
      firstSeen: '2024-01-06T10:00:00Z',
      lastSeen: '2024-01-14T12:00:00Z',
      firstRelease: sameRelease,
      lastRelease: sameRelease,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      method: 'GET',
      body: group,
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

    const releaseTexts = await screen.findAllByText(
      textWithMarkupMatcher('in release 1.0.0')
    );
    expect(releaseTexts).toHaveLength(2);
  });

  it('handles missing release data gracefully', async () => {
    const group = GroupFixture({
      project,
      firstSeen: '2024-01-06T10:00:00Z',
      lastSeen: '2024-01-14T12:00:00Z',
      firstRelease: null,
      lastRelease: null,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      method: 'GET',
      body: group,
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
