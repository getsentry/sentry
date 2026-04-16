import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  getDistributionErrorTooltip,
  InstallDetailsContent,
} from 'sentry/views/preprod/components/installDetailsContent';

describe('getDistributionErrorTooltip', () => {
  it('returns quota message for NO_QUOTA', () => {
    expect(getDistributionErrorTooltip('NO_QUOTA')).toBe('Distribution quota exceeded');
  });

  it('returns signature message for SKIPPED with invalid_signature', () => {
    expect(getDistributionErrorTooltip('SKIPPED', 'invalid_signature')).toBe(
      'Code signature is invalid'
    );
  });

  it('returns simulator message for SKIPPED with simulator', () => {
    expect(getDistributionErrorTooltip('SKIPPED', 'simulator')).toBe(
      'Simulator builds cannot be distributed'
    );
  });

  it('returns generic skipped message for SKIPPED with unknown message', () => {
    expect(getDistributionErrorTooltip('SKIPPED', 'something_else')).toBe(
      'Distribution was skipped'
    );
  });

  it('returns processing error message for PROCESSING_ERROR', () => {
    expect(getDistributionErrorTooltip('PROCESSING_ERROR')).toBe(
      'Distribution failed due to a processing error'
    );
  });

  it('returns fallback for no error code', () => {
    expect(getDistributionErrorTooltip(null, null)).toBe('Not installable');
    expect(getDistributionErrorTooltip(undefined, undefined)).toBe('Not installable');
  });
});

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

  it('shows distribution error reason when no install URL and error code is provided', async () => {
    MockApiClient.addMockResponse({
      url: INSTALL_DETAILS_URL,
      body: {
        platform: 'apple',
        is_code_signature_valid: true,
      },
    });

    render(
      <InstallDetailsContent
        artifactId="artifact-1"
        distributionErrorCode="SKIPPED"
        distributionErrorMessage="simulator"
      />,
      {organization}
    );

    expect(
      await screen.findByText('Simulator builds cannot be distributed')
    ).toBeInTheDocument();
  });

  it('shows generic fallback when no install URL and no error code', async () => {
    MockApiClient.addMockResponse({
      url: INSTALL_DETAILS_URL,
      body: {
        platform: 'apple',
        is_code_signature_valid: true,
      },
    });

    render(<InstallDetailsContent artifactId="artifact-1" />, {organization});

    expect(
      await screen.findByText('No install download link available')
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
