import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {IntegrationRow} from 'sentry/views/settings/organizationIntegrations/integrationRow';

describe('IntegrationRow', () => {
  const {organization: org} = initializeOrg();

  describe('SentryApp', () => {
    it('is an internal SentryApp', () => {
      render(
        <IntegrationRow
          organization={org}
          type="sentryApp"
          slug="my-headband-washer-289499"
          displayName="My Headband Washer"
          status="Installed"
          publishStatus="internal"
          configurations={0}
          categories={[]}
        />
      );
      expect(screen.getByText('My Headband Washer')).toBeInTheDocument();
      expect(screen.getByText('Installed')).toBeInTheDocument();
      expect(screen.getByText('internal')).toBeInTheDocument();
    });

    it('is a published SentryApp', () => {
      render(
        <IntegrationRow
          organization={org}
          type="sentryApp"
          slug="clickup"
          displayName="ClickUp"
          status="Not Installed"
          publishStatus="published"
          configurations={0}
          categories={[]}
        />
      );
      expect(screen.getByText('ClickUp')).toBeInTheDocument();
      expect(screen.getByText('ClickUp')).toHaveAttribute(
        'href',
        `/settings/${org.slug}/sentry-apps/clickup/`
      );
      expect(screen.getByText('Not Installed')).toBeInTheDocument();
    });
  });
  describe('First Party Integration', () => {
    it('has been installed (1 configuration)', () => {
      render(
        <IntegrationRow
          organization={org}
          type="firstParty"
          slug="bitbucket"
          displayName="Bitbucket"
          status="Installed"
          publishStatus="published"
          configurations={1}
          categories={[]}
        />
      );
      expect(screen.getByText('Bitbucket')).toBeInTheDocument();
      expect(screen.getByText('Bitbucket')).toHaveAttribute(
        'href',
        `/settings/${org.slug}/integrations/bitbucket/`
      );
      expect(screen.getByText('1 Configuration')).toBeInTheDocument();
    });

    it('has been installed (3 configurations)', () => {
      render(
        <IntegrationRow
          organization={org}
          type="firstParty"
          slug="bitbucket"
          displayName="Bitbucket"
          status="Installed"
          publishStatus="published"
          configurations={3}
          categories={[]}
        />
      );
      expect(screen.getByText('Installed')).toBeInTheDocument();
      expect(screen.getByText('Bitbucket')).toHaveAttribute(
        'href',
        `/settings/${org.slug}/integrations/bitbucket/`
      );
      expect(screen.getByText('3 Configurations')).toBeInTheDocument();
    });

    it('has not been installed', () => {
      render(
        <IntegrationRow
          organization={org}
          type="firstParty"
          slug="github"
          displayName="GitHub"
          status="Not Installed"
          publishStatus="published"
          configurations={0}
          categories={[]}
        />
      );
      expect(screen.getByText('Not Installed')).toBeInTheDocument();
      expect(screen.getByText('GitHub')).toHaveAttribute(
        'href',
        `/settings/${org.slug}/integrations/github/`
      );
    });
  });

  describe('Update Now alert', () => {
    it('does not render the alert icon when up to date', () => {
      render(
        <IntegrationRow
          organization={org}
          type="firstParty"
          slug="slack"
          displayName="Slack"
          status="Installed"
          publishStatus="published"
          configurations={1}
          categories={[]}
        />
      );
      expect(screen.queryByLabelText('Integration alert')).not.toBeInTheDocument();
    });

    it('auto-opens the install modal when a single workspace is outdated', async () => {
      render(
        <IntegrationRow
          organization={org}
          type="firstParty"
          slug="slack"
          displayName="Slack"
          status="Installed"
          publishStatus="published"
          configurations={2}
          categories={[]}
          outdatedConfigurations={1}
        />
      );
      await userEvent.hover(screen.getByLabelText('Integration alert'));
      expect(await screen.findByRole('link', {name: 'click here'})).toHaveAttribute(
        'href',
        `/settings/${org.slug}/integrations/slack/?tab=configurations&referrer=directory_resolve_now&showInstallModal=1`
      );
    });

    it('auto-opens the permissions modal for an outdated GitHub integration', async () => {
      render(
        <IntegrationRow
          organization={org}
          type="firstParty"
          slug="github"
          displayName="GitHub"
          status="Installed"
          publishStatus="published"
          configurations={2}
          categories={[]}
          outdatedConfigurations={1}
        />
      );
      await userEvent.hover(screen.getByLabelText('Integration alert'));
      expect(await screen.findByRole('link', {name: 'click here'})).toHaveAttribute(
        'href',
        `/settings/${org.slug}/integrations/github/?tab=configurations&referrer=directory_resolve_now&showPermsModal=1`
      );
    });

    it('sends users to the config page when multiple workspaces are outdated', async () => {
      render(
        <IntegrationRow
          organization={org}
          type="firstParty"
          slug="slack"
          displayName="Slack"
          status="Installed"
          publishStatus="published"
          configurations={2}
          categories={[]}
          outdatedConfigurations={2}
        />
      );
      await userEvent.hover(screen.getByLabelText('Integration alert'));
      const link = await screen.findByRole('link', {name: 'click here'});
      expect(link).toHaveAttribute(
        'href',
        `/settings/${org.slug}/integrations/slack/?tab=configurations&referrer=directory_resolve_now`
      );
      expect(link.getAttribute('href')).not.toContain('showInstallModal');
    });

    it('shows an informational tooltip without a link for members without access', async () => {
      const {organization: lowerAccessOrg} = initializeOrg({
        organization: {access: ['org:read']},
      });
      render(
        <IntegrationRow
          organization={lowerAccessOrg}
          type="firstParty"
          slug="slack"
          displayName="Slack"
          status="Installed"
          publishStatus="published"
          configurations={2}
          categories={[]}
          outdatedConfigurations={1}
        />
      );
      await userEvent.hover(screen.getByLabelText('Integration alert'));
      // The warning icon still surfaces the update, but without an actionable
      // link that would try to launch a flow the member can't complete.
      expect(await screen.findByText(/please update your workspace/)).toBeInTheDocument();
      expect(screen.queryByRole('link', {name: 'click here'})).not.toBeInTheDocument();
    });
  });
});
