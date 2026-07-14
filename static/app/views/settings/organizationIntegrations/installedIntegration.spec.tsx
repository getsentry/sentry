import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {InstalledIntegration} from 'sentry/views/settings/organizationIntegrations/installedIntegration';

describe('InstalledIntegration', () => {
  const organization = OrganizationFixture();

  const defaultProps = {
    organization,
    integration: OrganizationIntegrationsFixture() as any,
    provider: GitHubIntegrationProviderFixture(),
    onRemove: jest.fn(),
    onDisable: jest.fn(),
    trackIntegrationAnalytics: jest.fn(),
  };

  it('shows the Configure button normally', () => {
    render(<InstalledIntegration {...defaultProps} />);

    expect(screen.getByRole('button', {name: 'Configure'})).toBeInTheDocument();
  });

  it('hides the Configure button when directEnable aspect is set', () => {
    const provider = GitHubIntegrationProviderFixture({
      metadata: {
        ...GitHubIntegrationProviderFixture().metadata,
        aspects: {directEnable: true},
      },
    });

    render(<InstalledIntegration {...defaultProps} provider={provider} />);

    expect(screen.queryByRole('link', {name: 'Configure'})).not.toBeInTheDocument();
  });

  it('always shows the Uninstall button', () => {
    render(<InstalledIntegration {...defaultProps} />);

    expect(screen.getByRole('button', {name: 'Uninstall'})).toBeInTheDocument();
  });

  it('always shows the Uninstall button when directEnable is set', () => {
    const provider = GitHubIntegrationProviderFixture({
      metadata: {
        ...GitHubIntegrationProviderFixture().metadata,
        aspects: {directEnable: true},
      },
    });

    render(<InstalledIntegration {...defaultProps} provider={provider} />);

    expect(screen.getByRole('button', {name: 'Uninstall'})).toBeInTheDocument();
  });

  it('shows an admin tooltip on the disabled Update Now button', async () => {
    const lowerAccessOrg = OrganizationFixture({access: ['org:read']});

    render(
      <InstalledIntegration
        {...defaultProps}
        organization={lowerAccessOrg}
        requiresUpgrade
      />,
      {organization: lowerAccessOrg}
    );

    const updateButton = screen.getByRole('button', {name: 'Update Now'});
    expect(updateButton).toBeDisabled();

    await userEvent.hover(updateButton);
    expect(
      await screen.findByText(
        'You must be an organization owner, manager or admin to update'
      )
    ).toBeInTheDocument();
  });
});
