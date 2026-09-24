import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {GitLabIntegrationFixture} from 'sentry-fixture/gitlabIntegration';
import {GitLabIntegrationProviderFixture} from 'sentry-fixture/gitlabIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as pipelineModal from 'sentry/components/pipeline/modal';
import * as integrationUtil from 'sentry/utils/integrationUtil';
import IntegrationDetailedView from 'sentry/views/settings/organizationIntegrations/integrationDetailedView';

describe('IntegrationDetailedView', () => {
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

  const missingFeatures = [
    {key: 'seer_mentions', description: 'Server-provided Seer mentions feature.'},
  ];
  const slackIntegration = OrganizationIntegrationsFixture({
    outOfDate: true,
    missingFeatures,
  });

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
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/config/integrations/`,
      match: [MockApiClient.matchQuery({provider_key: 'slack'})],
      body: {
        providers: [
          {
            canAdd: true,
            canDisable: false,
            features: ['alert-rule', 'chat-unfurl'],
            key: 'slack',
            metadata: {
              aspects: {},
              author: 'The Sentry Team',
              description: 'Connect your Sentry organization to Slack.',
              features: [],
              issue_url: 'https://github.com/getsentry/sentry/issues/new',
              noun: 'Installation',
              source_url:
                'https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/slack',
            },
            name: 'Slack',
            slug: 'slack',
          },
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      match: [MockApiClient.matchQuery({provider_key: 'slack', includeConfig: 0})],
      body: [slackIntegration],
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows integration name, status, and install button', async () => {
    render(<IntegrationDetailedView />, {
      initialRouterConfig: createRouterConfig('bitbucket'),
      organization,
    });
    expect(await screen.findByText('Bitbucket')).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Overview'})).toBeInTheDocument();
    expect(screen.getByText('Installed')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Add integration'})).toBeEnabled();
  });

  it('shows the selected tab in the breadcrumb while loading data', () => {
    render(<IntegrationDetailedView />, {
      initialRouterConfig: createRouterConfig('bitbucket'),
      organization,
    });

    expect(screen.getByRole('heading', {name: 'Overview'})).toBeInTheDocument();
  });

  it('view configurations', async () => {
    render(<IntegrationDetailedView />, {
      initialRouterConfig: createRouterConfig('bitbucket', {tab: 'configurations'}),
      organization,
    });
    expect(
      await screen.findByText('{fb715533-bbd7-4666-aa57-01dc93dd9cc0}')
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configurations'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Configure'})).toBeEnabled();
  });

  it('shows Update Now only for the outdated Slack workspace', async () => {
    const openPipelineModalSpy = jest
      .spyOn(pipelineModal, 'openPipelineModal')
      .mockImplementation(() => {});
    const slackProvider = {
      aspects: {},
      canAdd: true,
      canDisable: false,
      features: ['alert-rule', 'chat-unfurl'],
      key: 'slack',
      name: 'Slack',
      slug: 'slack',
    };
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      match: [MockApiClient.matchQuery({provider_key: 'slack', includeConfig: 0})],
      body: [
        {
          id: '10',
          name: 'Outdated Workspace',
          domainName: 'outdated.slack.com',
          provider: slackProvider,
          status: 'active',
          outOfDate: true,
          missingFeatures,
        },
        {
          id: '11',
          name: 'Current Workspace',
          domainName: 'current.slack.com',
          provider: slackProvider,
          status: 'active',
          outOfDate: false,
        },
      ],
    });

    render(<IntegrationDetailedView />, {
      initialRouterConfig: createRouterConfig('slack', {tab: 'configurations'}),
      organization,
    });

    expect(await screen.findByText('Outdated Workspace')).toBeInTheDocument();
    expect(screen.getByText('Current Workspace')).toBeInTheDocument();

    // Only the outdated workspace surfaces an Update Now button, not every row.
    expect(screen.getByTestId('integration-upgrade-button')).toBeInTheDocument();
    expect(screen.getAllByTestId('integration-upgrade-button')).toHaveLength(1);
    await userEvent.click(screen.getByTestId('integration-upgrade-button'));
    expect(openPipelineModalSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'slack',
        title: 'Update Slack App Permissions',
        description: expect.stringContaining('Server-provided Seer mentions feature.'),
      })
    );
  });

  describe('overview upgrade button', () => {
    const slackProvider = {
      aspects: {},
      canAdd: true,
      canDisable: false,
      features: ['alert-rule', 'chat-unfurl'],
      key: 'slack',
      name: 'Slack',
      slug: 'slack',
    };

    const outdatedWorkspace = {
      id: '10',
      name: 'Outdated Workspace',
      domainName: 'outdated.slack.com',
      provider: slackProvider,
      status: 'active',
      outOfDate: true,
      missingFeatures,
    };

    it('explains the Slack permissions when updating from the overview', async () => {
      const openPipelineModalSpy = jest
        .spyOn(pipelineModal, 'openPipelineModal')
        .mockImplementation(() => {});
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/integrations/`,
        match: [MockApiClient.matchQuery({provider_key: 'slack', includeConfig: 0})],
        body: [outdatedWorkspace],
      });

      render(<IntegrationDetailedView />, {
        initialRouterConfig: createRouterConfig('slack', {tab: 'overview'}),
        organization,
      });

      await userEvent.click(await screen.findByTestId('integration-upgrade-button'));
      expect(openPipelineModalSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'slack',
          title: 'Update Slack App Permissions',
          description: expect.stringContaining('Server-provided Seer mentions feature.'),
        })
      );
    });

    it('disables the update button for members without integration access', async () => {
      const lowerAccessOrg = OrganizationFixture({access: ['org:read']});
      MockApiClient.addMockResponse({
        url: `/organizations/${lowerAccessOrg.slug}/config/integrations/`,
        match: [MockApiClient.matchQuery({provider_key: 'slack'})],
        body: {
          providers: [
            {
              canAdd: true,
              canDisable: false,
              features: ['alert-rule', 'chat-unfurl'],
              key: 'slack',
              metadata: {
                aspects: {},
                author: 'The Sentry Team',
                description: 'Connect your Sentry organization to Slack.',
                features: [],
                issue_url: 'https://github.com/getsentry/sentry/issues/new',
                noun: 'Installation',
                source_url:
                  'https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/slack',
              },
              name: 'Slack',
              slug: 'slack',
            },
          ],
        },
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${lowerAccessOrg.slug}/integrations/`,
        match: [MockApiClient.matchQuery({provider_key: 'slack', includeConfig: 0})],
        body: [outdatedWorkspace],
      });

      render(<IntegrationDetailedView />, {
        initialRouterConfig: createRouterConfig('slack', {tab: 'overview'}),
        organization: lowerAccessOrg,
      });

      // The reinstall button (which auto-opens the install modal) must never
      // render for members without access; a disabled Update button shows instead.
      expect(await screen.findByRole('button', {name: 'Update'})).toBeDisabled();
      expect(screen.queryByTestId('integration-upgrade-button')).not.toBeInTheDocument();
    });
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
    expect(await screen.findByRole('button', {name: 'Configure'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('disables uninstall button when integration is pending deletion', async () => {
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
          organizationIntegrationStatus: 'pending_deletion',
        },
      ],
    });

    render(<IntegrationDetailedView />, {
      initialRouterConfig: createRouterConfig('bitbucket', {tab: 'configurations'}),
      organization,
    });
    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Uninstall'})).toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });
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
    expect(await screen.findByRole('button', {name: 'Configure'})).toBeEnabled();
  });

  it('does not show features tab for github', async () => {
    render(<IntegrationDetailedView />, {
      initialRouterConfig: createRouterConfig('github'),
      organization,
    });
    expect(await screen.findByText('overview')).toBeInTheDocument();
    expect(screen.queryByText('features')).not.toBeInTheDocument();
  });

  it('does not show features tab for gitlab', async () => {
    render(<IntegrationDetailedView />, {
      initialRouterConfig: createRouterConfig('gitlab'),
      organization,
    });
    expect(await screen.findByText('overview')).toBeInTheDocument();
    expect(screen.queryByText('features')).not.toBeInTheDocument();
  });

  it('returns to overview when the selected integration does not support the tab', async () => {
    const {router} = render(<IntegrationDetailedView />, {
      initialRouterConfig: createRouterConfig('bitbucket', {tab: 'features'}),
      organization,
    });

    expect(await screen.findByRole('heading', {name: 'Overview'})).toBeInTheDocument();
    expect(router.location.query).toEqual({tab: 'features'});
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

  describe('auto-open install modal via showInstallModal param', () => {
    it('auto-opens the install modal when the param is set and the user has access', async () => {
      const openPipelineModalSpy = jest
        .spyOn(pipelineModal, 'openPipelineModal')
        .mockImplementation(() => {});

      render(<IntegrationDetailedView />, {
        initialRouterConfig: createRouterConfig('bitbucket', {showInstallModal: '1'}),
        organization,
      });

      expect(await screen.findByText('Bitbucket')).toBeInTheDocument();
      await waitFor(() => {
        expect(openPipelineModalSpy).toHaveBeenCalledTimes(1);
      });
      expect(openPipelineModalSpy).toHaveBeenCalledWith(
        expect.objectContaining({type: 'integration', provider: 'bitbucket'})
      );
    });

    it('passes the upgrade copy for the Slack provider', async () => {
      const openPipelineModalSpy = jest
        .spyOn(pipelineModal, 'openPipelineModal')
        .mockImplementation(() => {});

      render(<IntegrationDetailedView />, {
        initialRouterConfig: createRouterConfig('slack', {showInstallModal: '1'}),
        organization,
      });

      await waitFor(() => {
        expect(openPipelineModalSpy).toHaveBeenCalledTimes(1);
      });
      expect(openPipelineModalSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'slack',
          title: 'Update Slack App Permissions',
          description:
            'This workspace is missing permissions for the following features: Server-provided Seer mentions feature. Reauthorize the Sentry app in your Slack workspace and accept the updated permissions to continue.',
        })
      );
    });

    it.each([
      {body: []},
      {body: [OrganizationIntegrationsFixture({outOfDate: false, missingFeatures: []})]},
      {
        body: [
          OrganizationIntegrationsFixture({id: '1', outOfDate: true, missingFeatures}),
          OrganizationIntegrationsFixture({id: '2', outOfDate: true, missingFeatures}),
        ],
      },
    ])(
      'does not choose a Slack workspace without one upgrade target (%#)',
      async ({body}) => {
        const openPipelineModalSpy = jest
          .spyOn(pipelineModal, 'openPipelineModal')
          .mockImplementation(() => {});
        MockApiClient.addMockResponse({
          url: `/organizations/${organization.slug}/integrations/`,
          match: [MockApiClient.matchQuery({provider_key: 'slack', includeConfig: 0})],
          body,
        });

        const {router} = render(<IntegrationDetailedView />, {
          initialRouterConfig: createRouterConfig('slack', {
            tab: 'configurations',
            showInstallModal: '1',
          }),
          organization,
        });

        await waitFor(() =>
          expect(router.location.query.showInstallModal).toBeUndefined()
        );
        expect(openPipelineModalSpy).not.toHaveBeenCalled();
      }
    );

    it('waits for workspace data and opens once with that workspace’s features', async () => {
      const openPipelineModalSpy = jest
        .spyOn(pipelineModal, 'openPipelineModal')
        .mockImplementation(() => {});
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/integrations/`,
        match: [MockApiClient.matchQuery({provider_key: 'slack', includeConfig: 0})],
        asyncDelay: 100,
        body: [slackIntegration],
      });

      const {router} = render(<IntegrationDetailedView />, {
        initialRouterConfig: createRouterConfig('slack', {
          tab: 'configurations',
          showInstallModal: '1',
        }),
        organization,
      });
      expect(openPipelineModalSpy).not.toHaveBeenCalled();
      expect(router.location.query.showInstallModal).toBe('1');
      await waitFor(() => expect(router.location.query.showInstallModal).toBeUndefined());
      expect(openPipelineModalSpy).toHaveBeenCalledTimes(1);
      expect(openPipelineModalSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining('Server-provided Seer mentions feature.'),
        })
      );
    });

    it('does not auto-open without the param', async () => {
      const openPipelineModalSpy = jest
        .spyOn(pipelineModal, 'openPipelineModal')
        .mockImplementation(() => {});

      render(<IntegrationDetailedView />, {
        initialRouterConfig: createRouterConfig('bitbucket'),
        organization,
      });

      expect(await screen.findByText('Bitbucket')).toBeInTheDocument();
      expect(openPipelineModalSpy).not.toHaveBeenCalled();
    });

    it('does not auto-open without integration access', async () => {
      const openPipelineModalSpy = jest
        .spyOn(pipelineModal, 'openPipelineModal')
        .mockImplementation(() => {});

      const lowerAccessOrg = OrganizationFixture({access: ['org:read']});
      MockApiClient.addMockResponse({
        url: `/organizations/${lowerAccessOrg.slug}/config/integrations/`,
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
                description: 'Connect your Sentry organization to Bitbucket.',
                features: [],
                issue_url: 'https://github.com/getsentry/sentry/issues/new',
                noun: 'Installation',
                source_url:
                  'https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/bitbucket',
              },
              name: 'Bitbucket',
              slug: 'bitbucket',
            },
          ],
        },
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${lowerAccessOrg.slug}/integrations/`,
        match: [MockApiClient.matchQuery({provider_key: 'bitbucket', includeConfig: 0})],
        body: [],
      });

      render(<IntegrationDetailedView />, {
        initialRouterConfig: createRouterConfig('bitbucket', {showInstallModal: '1'}),
        organization: lowerAccessOrg,
      });

      expect(await screen.findByText('Bitbucket')).toBeInTheDocument();
      expect(openPipelineModalSpy).not.toHaveBeenCalled();
    });

    it('does not auto-open when the plan gate disables install', async () => {
      const openPipelineModalSpy = jest
        .spyOn(pipelineModal, 'openPipelineModal')
        .mockImplementation(() => {});

      // Simulate the gsApp IntegrationFeatures gate reporting the integration as
      // plan-disabled (the default sentry gate always reports enabled).
      jest.spyOn(integrationUtil, 'getIntegrationFeatureGate').mockReturnValue({
        IntegrationFeatures: ({children}) =>
          children({
            disabled: true,
            disabledReason: 'Requires a higher plan',
            ungatedFeatures: [],
            gatedFeatureGroups: [],
          }),
        FeatureList: () => null,
      });

      render(<IntegrationDetailedView />, {
        initialRouterConfig: createRouterConfig('slack', {showInstallModal: '1'}),
        organization,
      });

      expect(await screen.findByText('Slack')).toBeInTheDocument();
      expect(openPipelineModalSpy).not.toHaveBeenCalled();
    });

    it('re-opens for a different provider after client-side navigation', async () => {
      const openPipelineModalSpy = jest
        .spyOn(pipelineModal, 'openPipelineModal')
        .mockImplementation(() => {});

      const {router} = render(<IntegrationDetailedView />, {
        initialRouterConfig: createRouterConfig('bitbucket', {showInstallModal: '1'}),
        organization,
      });

      await waitFor(() => {
        expect(openPipelineModalSpy).toHaveBeenCalledWith(
          expect.objectContaining({provider: 'bitbucket'})
        );
      });

      // Same route, only the slug changes, so the view stays mounted. A fresh
      // param for a different provider must still auto-open.
      router.navigate('/settings/org-slug/integrations/slack/?showInstallModal=1');

      await waitFor(() => {
        expect(openPipelineModalSpy).toHaveBeenCalledWith(
          expect.objectContaining({provider: 'slack'})
        );
      });
      expect(openPipelineModalSpy).toHaveBeenCalledTimes(2);
    });

    it('strips the param after auto-opening', async () => {
      jest.spyOn(pipelineModal, 'openPipelineModal').mockImplementation(() => {});

      const {router} = render(<IntegrationDetailedView />, {
        initialRouterConfig: createRouterConfig('bitbucket', {showInstallModal: '1'}),
        organization,
      });

      await waitFor(() => {
        expect(router.location.query.showInstallModal).toBeUndefined();
      });
    });
  });
});
