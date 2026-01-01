import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {GitLabIntegrationFixture} from 'sentry-fixture/gitlabIntegration';
import {GitLabIntegrationProviderFixture} from 'sentry-fixture/gitlabIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import IntegrationDetailedView from 'sentry/views/settings/organizationIntegrations/integrationDetailedView';

describe('IntegrationDetailedView', () => {
  const ENDPOINT = '/organizations/org-slug/';
  const organization = OrganizationFixture({
    access: ['org:integrations', 'org:write'],
  });

  function createRouterConfig(integrationSlug: string, query?: Record<string, any>) {
    return {
      route: '/settings/:orgId/integrations/:integrationSlug/',
      location: {
        pathname: `/settings/org-slug/integrations/${integrationSlug}/`,
        ...(query && {query}),
      },
    };
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/config/integrations/`,
      match: [MockApiClient.matchQuery({provider_key: 'bitbucket'})],
      body: {
        providers: [
          {
            canAdd: true,
            canDisable: false,
            features: ['commits', 'issue-basic'],
            key: 'bitbucket',

            metadata: {
              aspects: {},
              author: 'The Sentry Team',
              description:
                'Connect your Sentry organization to Bitbucket, enabling the following features:',

              features: [],
              issue_url:
                'https://github.com/getsentry/sentry/issues/new?template=bug.yml&title=Bitbucket%20Integration:%20&labels=Component%3A%20Integrations',
              noun: 'Installation',
              source_url:
                'https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/bitbucket',
            },
            name: 'Bitbucket',

            setupDialog: {
              height: 600,
              url: '/organizations/sentry/integrations/bitbucket/setup/',
              width: 600,
            },
            slug: 'bitbucket',
          },
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      match: [MockApiClient.matchQuery({provider_key: 'bitbucket', includeConfig: 0})],
      body: [
        {
          accountType: null,
          configData: {},
          configOrganization: [],
          domainName: 'bitbucket.org/%7Bfb715533-bbd7-4666-aa57-01dc93dd9cc0%7D',
          icon: 'https://secure.gravatar.com/avatar/8b4cb68e40b74c90427d8262256bd1c8?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FNN-0.png',
          id: '4',
          name: '{fb715533-bbd7-4666-aa57-01dc93dd9cc0}',
          provider: {
            aspects: {},
            canAdd: true,
            canDisable: false,
            features: ['commits', 'issue-basic'],
            key: 'bitbucket',
            name: 'Bitbucket',
            slug: 'bitbucket',
          },
          status: 'active',
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/config/integrations/`,
      match: [MockApiClient.matchQuery({provider_key: 'github'})],
      body: {
        providers: [GitHubIntegrationProviderFixture()],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      match: [MockApiClient.matchQuery({provider_key: 'github', includeConfig: 0})],
      body: [GitHubIntegrationFixture()],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/config/integrations/`,
      match: [MockApiClient.matchQuery({provider_key: 'gitlab'})],
      body: {
        providers: [GitLabIntegrationProviderFixture()],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      match: [MockApiClient.matchQuery({provider_key: 'gitlab', includeConfig: 0})],
      body: [GitLabIntegrationFixture()],
    });
  });

  it('shows integration name, status, and install button', async () => {
    render(<IntegrationDetailedView />, {
      initialRouterConfig: createRouterConfig('bitbucket'),
      organization,
    });
    expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();
    expect(screen.getByText('Bitbucket')).toBeInTheDocument();
    expect(screen.getByText('Installed')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Add integration'})).toBeEnabled();
  });

  it('view configurations', async () => {
    render(<IntegrationDetailedView />, {
      initialRouterConfig: createRouterConfig('bitbucket', {tab: 'configurations'}),
      organization,
    });
    expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();

    expect(screen.getByTestId('integration-name')).toHaveTextContent(
      '{fb715533-bbd7-4666-aa57-01dc93dd9cc0}'
    );
    expect(screen.getByRole('button', {name: 'Configure'})).toBeEnabled();
  });

  it('disables configure for members without access', async () => {
    const lowerAccessOrg = OrganizationFixture({access: ['org:read']});
    render(<IntegrationDetailedView />, {
      initialRouterConfig: {
        route: '/settings/:orgId/integrations/:integrationSlug/',
        location: {
          pathname: `/settings/${lowerAccessOrg.slug}/integrations/bitbucket/`,
          query: {tab: 'configurations'},
        },
      },
      organization: lowerAccessOrg,
    });
    expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Configure'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('allows members to configure github/gitlab', async () => {
    const lowerAccessOrganization = OrganizationFixture({access: ['org:read']});
    render(<IntegrationDetailedView />, {
      initialRouterConfig: {
        route: '/settings/:orgId/integrations/:integrationSlug/',
        location: {
          pathname: `/settings/${lowerAccessOrganization.slug}/integrations/github/`,
          query: {tab: 'configurations'},
        },
      },
      organization: lowerAccessOrganization,
    });
    expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Configure'})).toBeEnabled();
  });

  it('shows features tab for github only', async () => {
    render(<IntegrationDetailedView />, {
      initialRouterConfig: createRouterConfig('github'),
      organization,
    });
    expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();
    expect(screen.getByText('features')).toBeInTheDocument();
  });

  it('cannot enable PR bot without GitHub integration', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      match: [MockApiClient.matchQuery({provider_key: 'github', includeConfig: 0})],
      body: [],
    });
    render(<IntegrationDetailedView />, {
      initialRouterConfig: createRouterConfig('github'),
      organization,
    });
    expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('features'));

    expect(
      screen.getByRole('checkbox', {name: /Enable Comments on Suspect Pull Requests/})
    ).toBeDisabled();
  });

  it('can enable github features', async () => {
    render(<IntegrationDetailedView />, {
      initialRouterConfig: createRouterConfig('github'),
      organization,
    });
    expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('features'));

    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'PUT',
    });

    await userEvent.click(
      screen.getByRole('checkbox', {name: /Enable Comments on Suspect Pull Requests/})
    );

    await waitFor(() => {
      expect(mock).toHaveBeenCalledWith(
        ENDPOINT,
        expect.objectContaining({
          data: {githubPRBot: true},
        })
      );
    });

    await userEvent.click(
      screen.getByRole('checkbox', {name: /Enable Missing Member Detection/})
    );

    await waitFor(() => {
      expect(mock).toHaveBeenCalledWith(
        ENDPOINT,
        expect.objectContaining({
          data: {githubNudgeInvite: true},
        })
      );
    });
  });

  it('can enable gitlab features', async () => {
    render(<IntegrationDetailedView />, {
      initialRouterConfig: createRouterConfig('gitlab'),
      organization,
    });
    expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('features'));

    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'PUT',
    });

    await userEvent.click(
      screen.getByRole('checkbox', {name: /Enable Comments on Suspect Pull Requests/})
    );

    await waitFor(() => {
      expect(mock).toHaveBeenCalledWith(
        ENDPOINT,
        expect.objectContaining({
          data: {gitlabPRBot: true},
        })
      );
    });
  });

  it('renders alerts without crashing when variant is not provided', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/config/integrations/`,
      match: [],
      body: {
        providers: [
          {
            canAdd: true,
            canDisable: false,
            features: [],
            key: 'test-integration',
            metadata: {
              aspects: {
                alerts: [
                  {text: 'Alert without variant'},
                  {text: 'Alert with explicit variant', variant: 'warning'},
                ],
              },
              author: 'Test Author',
              description: 'Test integration',
              features: [],
              noun: 'Installation',
            },
            name: 'Test Integration',
            slug: 'test-integration',
          },
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      match: [
        MockApiClient.matchQuery({provider_key: 'test-integration', includeConfig: 0}),
      ],
      body: [],
    });

    render(<IntegrationDetailedView />, {
      initialRouterConfig: createRouterConfig('test-integration'),
      organization,
    });

    expect(await screen.findByText('Alert without variant')).toBeInTheDocument();
    expect(await screen.findByText('Alert with explicit variant')).toBeInTheDocument();
  });
});
