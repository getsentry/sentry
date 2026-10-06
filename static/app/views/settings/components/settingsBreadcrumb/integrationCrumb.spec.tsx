import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';
import {SentryAppFixture} from 'sentry-fixture/sentryApp';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {BreadcrumbTitle} from './breadcrumbTitle';
import {IntegrationCrumb} from './integrationCrumb';

describe('IntegrationCrumb', () => {
  const organization = OrganizationFixture();
  const githubProvider = GitHubIntegrationProviderFixture();
  const slackProvider = {
    ...githubProvider,
    key: 'slack',
    name: 'Slack',
    slug: 'slack',
  };

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/config/integrations/`,
      body: {providers: [githubProvider, slackProvider]},
    });
  });

  it('switches integrations while clearing the selected detail tab', async () => {
    const {router} = render(
      <IntegrationCrumb
        to="/settings/:orgId/integrations/:integrationSlug/"
        switchTo="/settings/:orgId/integrations/:providerKey/"
      >
        <BreadcrumbTitle title="Details" />
      </IntegrationCrumb>,
      {
        organization,
        initialRouterConfig: {
          route: '/settings/:orgId/integrations/:integrationSlug/',
          location: {
            pathname: `/settings/${organization.slug}/integrations/github/`,
            query: {tab: 'overview'},
          },
        },
      }
    );

    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Switch GitHub'})).toHaveAttribute(
        'aria-haspopup',
        'listbox'
      )
    );
    await userEvent.click(screen.getByRole('button', {name: 'Switch GitHub'}));
    await userEvent.click(screen.getByRole('option', {name: 'Slack'}));

    expect(router.location.pathname).toBe(
      `/settings/${organization.slug}/integrations/slack/`
    );
    expect(router.location.query).toEqual({});
  });

  it('returns to overview when switching from a configured item', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/1/`,
      body: OrganizationIntegrationsFixture({
        icon: 'https://example.com/custom-integration.png',
      }),
    });
    const {router} = render(
      <IntegrationCrumb
        to="/settings/:orgId/integrations/:providerKey/"
        switchTo="/settings/:orgId/integrations/:providerKey/"
      >
        <BreadcrumbTitle title="Details" />
      </IntegrationCrumb>,
      {
        organization,
        initialRouterConfig: {
          route: '/settings/:orgId/integrations/:providerKey/:integrationId/',
          location: {
            pathname: `/settings/${organization.slug}/integrations/github/1/`,
          },
        },
      }
    );

    const integrationButton = await screen.findByRole('button', {name: 'Switch GitHub'});
    expect(screen.queryByRole('link', {name: 'GitHub'})).not.toBeInTheDocument();
    expect(integrationButton.closest('li')?.querySelector('img')).toHaveAttribute(
      'src',
      'https://example.com/custom-integration.png'
    );

    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Switch GitHub'})).toHaveAttribute(
        'aria-haspopup',
        'listbox'
      )
    );
    await userEvent.click(screen.getByRole('button', {name: 'Switch GitHub'}));
    await userEvent.click(screen.getByRole('option', {name: 'Slack'}));

    expect(router.location.pathname).toBe(
      `/settings/${organization.slug}/integrations/slack/`
    );
    expect(router.location.query).toEqual({});
  });

  it('shows the Sentry App icon on its overview page', async () => {
    MockApiClient.addMockResponse({
      url: '/sentry-apps/shortcut/',
      body: SentryAppFixture({
        name: 'Shortcut',
        slug: 'shortcut',
        avatars: [
          {
            avatarType: 'upload',
            avatarUrl: 'https://example.com/shortcut.png',
            avatarUuid: 'shortcut-avatar',
            color: true,
            photoType: 'logo',
          },
        ],
      }),
    });

    render(
      <IntegrationCrumb
        to="/settings/:orgId/sentry-apps/:integrationSlug/"
        switchTo="/settings/:orgId/integrations/:providerKey/"
        isSentryAppRoute
      >
        <BreadcrumbTitle title="Details" />
      </IntegrationCrumb>,
      {
        organization,
        initialRouterConfig: {
          route: '/settings/:orgId/sentry-apps/:integrationSlug/',
          location: {
            pathname: `/settings/${organization.slug}/sentry-apps/shortcut/`,
          },
        },
      }
    );

    const integrationButton = await screen.findByRole('button', {
      name: 'Switch Shortcut',
    });
    expect(screen.queryByRole('link', {name: 'Shortcut'})).not.toBeInTheDocument();
    expect(integrationButton.closest('li')?.querySelector('img')).toHaveAttribute(
      'src',
      'https://example.com/shortcut.png?s=120'
    );
    expect(screen.getByRole('button', {name: 'Switch Shortcut'})).toBeInTheDocument();
  });
});
