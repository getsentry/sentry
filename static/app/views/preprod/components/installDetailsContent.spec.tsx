import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  getDistributionErrorTooltip,
  InstallDetailsContent,
} from 'sentry/views/preprod/components/installDetailsContent';

describe('getDistributionErrorTooltip', () => {
  it('returns the backend-provided message verbatim when present', () => {
    expect(
      getDistributionErrorTooltip(
        'simulator_build',
        'Simulator builds cannot be distributed.'
      )
    ).toBe('Simulator builds cannot be distributed.');
  });

  it('translates legacy skipped + invalid_signature message', () => {
    expect(getDistributionErrorTooltip('skipped', 'invalid_signature')).toBe(
      'Code signature is invalid'
    );
  });

  it('translates legacy skipped + simulator message', () => {
    expect(getDistributionErrorTooltip('skipped', 'simulator')).toBe(
      'Simulator builds cannot be distributed'
    );
  });

  it('falls back to a generic label when no message is provided', () => {
    expect(getDistributionErrorTooltip('no_quota')).toBe('Not installable');
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

  it('shows settings link on 404 when distribution is disabled', async () => {
    MockApiClient.addMockResponse({
      url: INSTALL_DETAILS_URL,
      statusCode: 404,
      body: {error: 'Installable file not available'},
    });

    render(
      <InstallDetailsContent
        artifactId="artifact-1"
        projectSlug="my-project"
        distributionErrorCode="distribution_disabled"
        distributionErrorMessage="Distribution disabled for this project"
      />,
      {organization}
    );

    expect(
      await screen.findByText('Build distribution is not enabled')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Retry'})).not.toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'project settings'})).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/projects/my-project/mobile-builds/?tab=distribution`
    );
  });

  it('shows backend error message on 404 for non-disabled distribution errors', async () => {
    MockApiClient.addMockResponse({
      url: INSTALL_DETAILS_URL,
      statusCode: 404,
      body: {error: 'Installable file not available'},
    });

    render(
      <InstallDetailsContent
        artifactId="artifact-1"
        projectSlug="my-project"
        distributionErrorCode="no_quota"
        distributionErrorMessage="Distribution quota exceeded"
      />,
      {organization}
    );

    expect(await screen.findByText('Distribution quota exceeded')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', {name: 'project settings'})
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Retry'})).not.toBeInTheDocument();
  });

  it('shows generic fallback on 404 when no error code is provided', async () => {
    MockApiClient.addMockResponse({
      url: INSTALL_DETAILS_URL,
      statusCode: 404,
      body: {error: 'Installable file not available'},
    });

    render(<InstallDetailsContent artifactId="artifact-1" projectSlug="my-project" />, {
      organization,
    });

    expect(
      await screen.findByText('No install download link available')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', {name: 'project settings'})
    ).not.toBeInTheDocument();
  });

  it('shows generic error with retry for non-404 errors', async () => {
    MockApiClient.addMockResponse({
      url: INSTALL_DETAILS_URL,
      statusCode: 500,
      body: {detail: 'Internal error'},
    });

    render(<InstallDetailsContent artifactId="artifact-1" projectSlug="my-project" />, {
      organization,
    });

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
        projectSlug="my-project"
        distributionErrorCode="simulator_build"
        distributionErrorMessage="Simulator builds cannot be distributed."
      />,
      {organization}
    );

    expect(
      await screen.findByText('Simulator builds cannot be distributed.')
    ).toBeInTheDocument();
  });

  it('shows settings link when error code is distribution_disabled', async () => {
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
        projectSlug="my-project"
        distributionErrorCode="distribution_disabled"
      />,
      {organization}
    );

    expect(
      await screen.findByText('Build distribution is not enabled')
    ).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'project settings'})).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/projects/my-project/mobile-builds/?tab=distribution`
    );
  });

  it('shows generic fallback when no install URL and no error code', async () => {
    MockApiClient.addMockResponse({
      url: INSTALL_DETAILS_URL,
      body: {
        platform: 'apple',
        is_code_signature_valid: true,
      },
    });

    render(<InstallDetailsContent artifactId="artifact-1" projectSlug="my-project" />, {
      organization,
    });

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

    render(<InstallDetailsContent artifactId="artifact-1" projectSlug="my-project" />, {
      organization,
    });

    expect(await screen.findByText('5 downloads')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Download'})).toBeInTheDocument();
  });
});
