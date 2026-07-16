import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import {OrganizationStore} from 'sentry/stores/organizationStore';
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

  it('does not show the admin tooltip when Update Now is disabled for status', async () => {
    render(
      <InstalledIntegration
        {...defaultProps}
        integration={
          OrganizationIntegrationsFixture({
            organizationIntegrationStatus: 'disabled',
          }) as any
        }
        requiresUpgrade
      />
    );

    const updateButton = screen.getByRole('button', {name: 'Update Now'});
    expect(updateButton).toBeDisabled();

    await userEvent.hover(updateButton);
    expect(
      screen.queryByText('You must be an organization owner, manager or admin to update')
    ).not.toBeInTheDocument();
  });

  it('allows superusers to update without the admin tooltip', () => {
    const superuserOrg = OrganizationFixture({
      access: ['org:read', 'org:superuser'],
    });
    OrganizationStore.onUpdate(superuserOrg, {replace: true});
    ConfigStore.set('user', UserFixture({isSuperuser: true}));

    render(
      <InstalledIntegration
        {...defaultProps}
        organization={superuserOrg}
        requiresUpgrade
      />,
      {organization: superuserOrg}
    );

    expect(screen.getByRole('button', {name: 'Update Now'})).toBeEnabled();
  });
});
