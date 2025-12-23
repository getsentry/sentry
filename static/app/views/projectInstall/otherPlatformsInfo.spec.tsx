import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {OtherPlatformsInfo} from 'sentry/views/projectInstall/otherPlatformsInfo';

describe('OtherPlatformsInfo', () => {
  const organization = OrganizationFixture();

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders loading state', () => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/test-project/keys/`,
      body: ProjectKeysFixture(),
      statusCode: 200,
    });

    render(<OtherPlatformsInfo projectSlug="test-project" platform="custom-platform" />, {
      organization,
    });

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('renders error state and allows retry', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/test-project/keys/`,
      statusCode: 500,
    });

    render(<OtherPlatformsInfo projectSlug="test-project" platform="custom-platform" />, {
      organization,
    });

    expect(
      await screen.findByText('There was an error loading data.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Retry'})).toBeInTheDocument();
  });

  it('renders DSN when available', async () => {
    const projectKeys = ProjectKeysFixture();

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/test-project/keys/`,
      body: projectKeys,
    });

    render(<OtherPlatformsInfo projectSlug="test-project" platform="custom-platform" />, {
      organization,
    });

    expect(
      await screen.findByText(
        /We cannot provide instructions for 'custom-platform' projects/
      )
    ).toBeInTheDocument();

    expect(screen.getByText(/dsn:/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(projectKeys[0]!.dsn.public))).toBeInTheDocument();
  });

  it('renders warning when no DSN is available', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/test-project/keys/`,
      body: [],
    });

    render(<OtherPlatformsInfo projectSlug="test-project" platform="custom-platform" />, {
      organization,
    });

    expect(
      await screen.findByText(
        /We cannot provide instructions for 'custom-platform' projects/
      )
    ).toBeInTheDocument();

    expect(screen.getByText(/No DSN found for this project/)).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'project settings'})).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/settings/projects/test-project/keys/`
    );
  });
});
