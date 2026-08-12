import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

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

  it('switches integrations while preserving the selected detail tab', async () => {
    const route = {path: ':integrationSlug', name: 'Integration Details'};
    const {router} = render(<IntegrationCrumb route={route} routes={[route]} isLast />, {
      organization,
      initialRouterConfig: {
        route: '/settings/:orgId/integrations/:integrationSlug/',
        location: {
          pathname: `/settings/${organization.slug}/integrations/github/`,
          query: {tab: 'overview'},
        },
      },
    });

    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'GitHub'})).toHaveAttribute(
        'aria-haspopup',
        'listbox'
      )
    );
    await userEvent.hover(screen.getByRole('button', {name: 'GitHub'}));
    await userEvent.click(screen.getByRole('option', {name: 'Slack'}));

    expect(router.location.pathname).toBe(
      `/settings/${organization.slug}/integrations/slack/`
    );
    expect(router.location.query).toEqual({tab: 'overview'});
  });

  it('returns to overview when switching from a configured item', async () => {
    const route = {
      path: ':providerKey/:integrationId/',
      name: 'Configure Integration',
    };
    const {router} = render(<IntegrationCrumb route={route} routes={[route]} isLast />, {
      organization,
      initialRouterConfig: {
        route: '/settings/:orgId/integrations/:providerKey/:integrationId/',
        location: {
          pathname: `/settings/${organization.slug}/integrations/github/1/`,
        },
      },
    });

    expect(await screen.findByRole('link', {name: /GitHub/})).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/integrations/github/`
    );

    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'GitHub'})).toHaveAttribute(
        'aria-haspopup',
        'listbox'
      )
    );
    await userEvent.hover(screen.getByRole('button', {name: 'GitHub'}));
    await userEvent.click(screen.getByRole('option', {name: 'Slack'}));

    expect(router.location.pathname).toBe(
      `/settings/${organization.slug}/integrations/slack/`
    );
    expect(router.location.query).toEqual({});
  });
});
