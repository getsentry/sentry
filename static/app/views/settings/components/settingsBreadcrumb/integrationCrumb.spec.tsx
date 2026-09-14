import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';
import {SentryAppFixture} from 'sentry-fixture/sentryApp';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

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
    const parentRoute = {path: 'integrations/', name: 'Integrations'};
    const route = {path: ':integrationSlug', name: 'Integration Details'};
    const {router} = render(
      <IntegrationCrumb route={route} routes={[parentRoute, route]} isLast />,
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
      expect(screen.getByRole('button', {name: 'GitHub'})).toHaveAttribute(
        'aria-haspopup',
        'listbox'
      )
    );
    expect(
      within(screen.getByRole('button', {name: 'GitHub'})).getByRole('img')
    ).toBeInTheDocument();
    await userEvent.hover(screen.getByRole('button', {name: 'GitHub'}));
    await userEvent.click(screen.getByRole('option', {name: 'Slack'}));

    expect(router.location.pathname).toBe(
      `/settings/${organization.slug}/integrations/slack/`
    );
    expect(router.location.query).toEqual({});
  });

  it('returns to overview when switching from a configured item', async () => {
    const parentRoute = {path: 'integrations/', name: 'Integrations'};
    const route = {
      path: ':providerKey/:integrationId/',
      name: 'Configure Integration',
    };
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/1/`,
      body: OrganizationIntegrationsFixture({
        icon: 'https://example.com/custom-integration.png',
      }),
    });
    const {router} = render(
      <IntegrationCrumb route={route} routes={[parentRoute, route]} isLast />,
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

    const integrationLink = await screen.findByRole('link', {name: /GitHub/});
    expect(integrationLink).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/integrations/github/`
    );
    expect(within(integrationLink).getByRole('img')).toHaveAttribute(
      'src',
      'https://example.com/custom-integration.png'
    );

    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'GitHub'})).toHaveAttribute(
        'aria-haspopup',
        'listbox'
      )
    );
    expect(
      within(screen.getByRole('button', {name: 'GitHub'})).getAllByRole('img')
    ).toHaveLength(2);
    await userEvent.hover(screen.getByRole('button', {name: 'GitHub'}));
    await userEvent.click(screen.getByRole('option', {name: 'Slack'}));

    expect(router.location.pathname).toBe(
      `/settings/${organization.slug}/integrations/slack/`
    );
    expect(router.location.query).toEqual({});
  });

  it('shows the Sentry App icon on its overview page', async () => {
    const parentRoute = {path: 'sentry-apps/', name: 'Integrations'};
    const route = {path: ':integrationSlug', name: 'Details'};
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

    render(<IntegrationCrumb route={route} routes={[parentRoute, route]} isLast />, {
      organization,
      initialRouterConfig: {
        route: '/settings/:orgId/sentry-apps/:integrationSlug/',
        location: {
          pathname: `/settings/${organization.slug}/sentry-apps/shortcut/`,
        },
      },
    });

    const integrationLink = await screen.findByRole('link', {name: /Shortcut/});
    expect(integrationLink).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/sentry-apps/shortcut/`
    );
    expect(within(integrationLink).getByRole('img')).toHaveAttribute(
      'src',
      'https://example.com/shortcut.png?s=120'
    );
    expect(
      within(screen.getByRole('button', {name: /Shortcut/})).getAllByRole('img')
    ).toHaveLength(1);
  });
});
