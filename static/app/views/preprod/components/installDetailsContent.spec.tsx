import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {InstallDetailsContent} from 'sentry/views/preprod/components/installDetailsContent';

describe('InstallDetailsContent', () => {
  const organization = OrganizationFixture();
  const INSTALL_DETAILS_URL = `/organizations/${organization.slug}/preprodartifacts/artifact-1/private-install-details/`;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('shows friendly error when API returns 404', async () => {
    MockApiClient.addMockResponse({
      url: INSTALL_DETAILS_URL,
      statusCode: 404,
      body: {error: 'Installable file not available'},
    });

    render(<InstallDetailsContent artifactId="artifact-1" />, {organization});

    expect(
      await screen.findByText('Build distribution is not enabled')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Retry'})).not.toBeInTheDocument();
  });

  it('shows settings link when projectSlug is provided and API returns 404', async () => {
    MockApiClient.addMockResponse({
      url: INSTALL_DETAILS_URL,
      statusCode: 404,
      body: {error: 'Installable file not available'},
    });

    render(<InstallDetailsContent artifactId="artifact-1" projectSlug="my-project" />, {
      organization,
    });

    expect(
      await screen.findByText('Build distribution is not enabled')
    ).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'project settings'})).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/projects/my-project/mobile-builds/?tab=distribution`
    );
  });

  it('shows message without link when projectSlug is not provided and API returns 404', async () => {
    MockApiClient.addMockResponse({
      url: INSTALL_DETAILS_URL,
      statusCode: 404,
      body: {error: 'Installable file not available'},
    });

    render(<InstallDetailsContent artifactId="artifact-1" />, {organization});

    expect(
      await screen.findByText('Build distribution is not enabled')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'The installable file is not available for this build. Enable build distribution in your project settings.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows generic error with retry for non-404 errors', async () => {
    MockApiClient.addMockResponse({
      url: INSTALL_DETAILS_URL,
      statusCode: 500,
      body: {detail: 'Internal error'},
    });

    render(<InstallDetailsContent artifactId="artifact-1" />, {organization});

    expect(
      await screen.findByRole('button', {name: 'Retry'}, {timeout: 10_000})
    ).toBeInTheDocument();
  });

  it('renders install details on success', async () => {
    MockApiClient.addMockResponse({
      url: INSTALL_DETAILS_URL,
      body: {
        platform: 'apple',
        install_url: 'https://example.com/install',
        is_code_signature_valid: true,
        profile_name: 'Dev Profile',
        codesigning_type: 'development',
        download_count: 5,
      },
    });

    render(<InstallDetailsContent artifactId="artifact-1" />, {organization});

    expect(await screen.findByText('5 downloads')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Download'})).toBeInTheDocument();
  });
});
