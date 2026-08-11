import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';
import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';
import {RepositoryFixture} from 'sentry-fixture/repository';
import {TeamFixture} from 'sentry-fixture/team';

import {
  act,
  render,
  renderGlobalModal,
  renderHookWithProviders,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  OnboardingContextProvider,
  useOnboardingContext,
} from 'sentry/components/onboarding/onboardingContext';
import type {ScmMessagingSetup} from 'sentry/components/onboarding/scm/scmMessagingSetup';
import * as useRecentCreatedProjectHook from 'sentry/components/onboarding/useRecentCreatedProject';
import {OnboardingDrawerStore} from 'sentry/stores/onboardingDrawerStore';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {TeamStore} from 'sentry/stores/teamStore';
import type {Organization} from 'sentry/types/organization';
import type {PlatformKey} from 'sentry/types/platform';
import {trackAnalytics} from 'sentry/utils/analytics';
import {OnboardingWithoutContext} from 'sentry/views/onboarding/onboarding';

jest.mock('sentry/utils/analytics');

describe('Onboarding', () => {
  beforeAll(() => {
    TeamStore.loadInitialData([TeamFixture()]);
  });
  afterEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
    sessionStorage.clear();
    jest.clearAllMocks();
  });

  it('renders the welcome UI', () => {
    render(
      <OnboardingContextProvider>
        <OnboardingWithoutContext />
      </OnboardingContextProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/onboarding/org-slug/welcome/',
          },
          route: '/onboarding/:orgId/:step/',
        },
      }
    );

    expect(screen.getByText('Welcome to Sentry')).toBeInTheDocument();
    expect(screen.getByText('Error monitoring')).toBeInTheDocument();
    expect(screen.getByText('Tracing')).toBeInTheDocument();
    expect(screen.getByText('Session replay')).toBeInTheDocument();
    expect(screen.getByTestId('onboarding-welcome-start')).toBeInTheDocument();
  });

  describe('welcome screen analytics', () => {
    it('calls trackAnalytics on mount', () => {
      render(
        <OnboardingContextProvider>
          <OnboardingWithoutContext />
        </OnboardingContextProvider>,
        {
          initialRouterConfig: {
            location: {
              pathname: '/onboarding/org-slug/welcome/',
            },
            route: '/onboarding/:orgId/:step/',
          },
        }
      );

      expect(trackAnalytics).toHaveBeenCalledWith(
        'growth.onboarding_start_onboarding',
        expect.objectContaining({
          source: 'targeted_onboarding',
        })
      );
    });

    it('fires the welcome event once when a stale platform is cleaned up', async () => {
      // The cleanup below writes onboarding state, which changes the context
      // value identity and re-runs the effect. The analytics event must not
      // ride along with that second pass.
      sessionStorage.setItem(
        'onboarding',
        JSON.stringify({
          selectedPlatform: {
            key: 'javascript-nextjs',
            type: 'framework',
            language: 'javascript',
            category: 'browser',
          },
        })
      );

      render(
        <OnboardingContextProvider>
          <OnboardingWithoutContext />
        </OnboardingContextProvider>,
        {
          initialRouterConfig: {
            location: {
              pathname: '/onboarding/org-slug/welcome/',
            },
            route: '/onboarding/:orgId/:step/',
          },
        }
      );

      await waitFor(() => {
        expect(sessionStorage.getItem('onboarding')).toBeNull();
      });

      expect(
        jest
          .mocked(trackAnalytics)
          .mock.calls.filter(call => call[0] === 'growth.onboarding_start_onboarding')
      ).toHaveLength(1);
    });

    it('calls trackAnalytics and onComplete on next button click', async () => {
      const {router} = render(
        <OnboardingContextProvider>
          <OnboardingWithoutContext />
        </OnboardingContextProvider>,
        {
          initialRouterConfig: {
            location: {
              pathname: '/onboarding/org-slug/welcome/',
            },
            route: '/onboarding/:orgId/:step/',
          },
        }
      );

      await userEvent.click(screen.getByTestId('onboarding-welcome-start'));

      expect(trackAnalytics).toHaveBeenCalledWith(
        'growth.onboarding_clicked_instrument_app',
        expect.objectContaining({
          source: 'targeted_onboarding',
        })
      );

      await waitFor(() => {
        expect(router.location.pathname).toBe('/onboarding/org-slug/select-platform/');
      });
    });

    it('calls trackAnalytics and activateSidebar on skip click', async () => {
      jest.useFakeTimers();
      const openSpy = jest.spyOn(OnboardingDrawerStore, 'open');

      try {
        render(
          <OnboardingContextProvider>
            <OnboardingWithoutContext />
          </OnboardingContextProvider>,
          {
            initialRouterConfig: {
              location: {
                pathname: '/onboarding/org-slug/welcome/',
              },
              route: '/onboarding/:orgId/:step/',
            },
          }
        );

        await userEvent.click(screen.getByRole('button', {name: 'Skip onboarding'}), {
          delay: null,
        });

        expect(trackAnalytics).toHaveBeenCalledWith(
          'growth.onboarding_clicked_skip',
          expect.objectContaining({
            source: 'targeted_onboarding',
          })
        );

        jest.runAllTimers();

        expect(openSpy).toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
        openSpy.mockRestore();
      }
    });
  });

  it('renders the select platform step', async () => {
    render(
      <OnboardingContextProvider>
        <OnboardingWithoutContext />
      </OnboardingContextProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/onboarding/org-slug/select-platform/',
          },
          route: '/onboarding/:orgId/:step/',
        },
      }
    );

    expect(
      await screen.findByText('Select the platform you want to monitor')
    ).toBeInTheDocument();
  });

  it('renders the setup docs step', async () => {
    const organization = OrganizationFixture();
    const nextJsProject = ProjectFixture({
      platform: 'javascript-nextjs',
      id: '2',
      slug: 'javascript-nextjs-slug',
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sdks/`,
      body: {},
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${nextJsProject.slug}/docs/javascript-nextjs-with-error-monitoring/`,
      body: null,
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${nextJsProject.slug}/`,
      body: [nextJsProject],
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${nextJsProject.slug}/issues/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${nextJsProject.slug}/keys/`,
      method: 'GET',
      body: [ProjectKeysFixture()[0]],
    });

    jest
      .spyOn(useRecentCreatedProjectHook, 'useRecentCreatedProject')
      .mockImplementation(() => {
        return {
          project: nextJsProject,
          isProjectActive: false,
        };
      });

    render(
      <OnboardingContextProvider
        initialValue={{
          selectedPlatform: {
            key: nextJsProject.slug as PlatformKey,
            type: 'framework',
            language: 'javascript',
            category: 'browser',
            name: 'Next.js',
            link: 'https://docs.sentry.io/platforms/javascript/guides/nextjs/',
          },
        }}
      >
        <OnboardingWithoutContext />
      </OnboardingContextProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: `/onboarding/${organization.slug}/setup-docs/`,
          },
          route: '/onboarding/:orgId/:step/',
        },
      }
    );

    expect(await screen.findByText('Configure Next.js SDK')).toBeInTheDocument();
  });

  it('does not render SDK data removal modal when going back', async () => {
    const organization = OrganizationFixture();
    const reactProject = ProjectFixture({
      platform: 'javascript-react',
      id: '2',
      slug: 'javascript-react-slug',
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sdks/`,
      body: {},
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${reactProject.slug}/`,
      body: [reactProject],
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${reactProject.slug}/keys/`,
      method: 'GET',
      body: [ProjectKeysFixture()[0]],
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${reactProject.slug}/issues/`,
      body: [],
    });

    jest
      .spyOn(useRecentCreatedProjectHook, 'useRecentCreatedProject')
      .mockImplementation(() => {
        return {
          project: reactProject,
          isProjectActive: true,
        };
      });

    render(
      <OnboardingContextProvider
        initialValue={{
          selectedPlatform: {
            key: reactProject.slug as PlatformKey,
            type: 'framework',
            language: 'javascript',
            category: 'browser',
            name: 'React',
            link: 'https://docs.sentry.io/platforms/javascript/guides/react/',
          },
        }}
      >
        <OnboardingWithoutContext />
      </OnboardingContextProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: `/onboarding/${organization.slug}/setup-docs/`,
          },
          route: '/onboarding/:orgId/:step/',
        },
      }
    );

    // Await for the docs to be loaded
    await screen.findByText('Configure React SDK');

    renderGlobalModal();

    // Click on back button
    await userEvent.click(screen.getByRole('button', {name: 'Back'}));

    // Await for the modal to be open
    expect(
      screen.queryByText(/Are you sure you want to head back?/)
    ).not.toBeInTheDocument();
  });

  it('renders framework selection modal if vanilla js is selected', async () => {
    render(
      <OnboardingContextProvider>
        <OnboardingWithoutContext />
      </OnboardingContextProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/onboarding/org-slug/select-platform/',
          },
          route: '/onboarding/:orgId/:step/',
        },
      }
    );

    renderGlobalModal();

    // Select the JavaScript platform
    await userEvent.click(screen.getByTestId('platform-javascript'));

    // Modal is open
    await screen.findByText('Do you use a framework?');
  });

  it('no longer display SDK data removal modal when going back', async () => {
    const organization = OrganizationFixture();
    const reactProject = ProjectFixture({
      platform: 'javascript-react',
      id: '2',
      slug: 'javascript-react-slug',
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sdks/`,
      body: {},
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${reactProject.slug}/`,
      body: [reactProject],
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${reactProject.slug}/keys/`,
      method: 'GET',
      body: [ProjectKeysFixture()[0]],
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${reactProject.slug}/issues/`,
      body: [],
    });

    jest
      .spyOn(useRecentCreatedProjectHook, 'useRecentCreatedProject')
      .mockImplementation(() => {
        return {
          project: reactProject,
          isProjectActive: true,
        };
      });

    render(
      <OnboardingContextProvider
        initialValue={{
          selectedPlatform: {
            key: reactProject.slug as PlatformKey,
            type: 'framework',
            language: 'javascript',
            category: 'browser',
            name: 'React',
            link: 'https://docs.sentry.io/platforms/javascript/guides/react/',
          },
        }}
      >
        <OnboardingWithoutContext />
      </OnboardingContextProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: `/onboarding/${organization.slug}/setup-docs/`,
          },
          route: '/onboarding/:orgId/:step/',
        },
      }
    );

    // Await for the docs to be loaded
    await screen.findByText('Configure React SDK');

    renderGlobalModal();

    // Click on back button
    await userEvent.click(screen.getByRole('button', {name: 'Back'}));

    // Await for the modal to be open
    expect(
      screen.queryByText(/Are you sure you want to head back?/)
    ).not.toBeInTheDocument();
  });

  it('clears all context when going back from setup-docs in legacy flow', async () => {
    const organization = OrganizationFixture();
    const reactProject = ProjectFixture({
      platform: 'javascript-react',
      id: '2',
      slug: 'javascript-react',
    });

    jest
      .spyOn(useRecentCreatedProjectHook, 'useRecentCreatedProject')
      .mockImplementation(() => ({
        project: reactProject,
        isProjectActive: false,
      }));

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sdks/`,
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${reactProject.slug}/keys/`,
      body: [ProjectKeysFixture()[0]],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${reactProject.slug}/issues/`,
      body: [],
    });

    const deleteProjectMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${reactProject.slug}/`,
      method: 'DELETE',
    });

    const initialContext = {
      selectedPlatform: {
        key: reactProject.slug as PlatformKey,
        type: 'framework',
        language: 'javascript',
        category: 'browser',
        name: 'React',
        link: 'https://docs.sentry.io/platforms/javascript/guides/react/',
      },
    };

    sessionStorage.setItem('onboarding', JSON.stringify(initialContext));

    render(
      <OnboardingContextProvider initialValue={initialContext}>
        <OnboardingWithoutContext />
      </OnboardingContextProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: `/onboarding/${organization.slug}/setup-docs/`,
          },
          route: '/onboarding/:orgId/:step/',
        },
      }
    );

    await userEvent.click(screen.getByRole('button', {name: 'Back'}));

    expect(deleteProjectMock).toHaveBeenCalled();

    // Legacy flow should clear all context
    const stored = sessionStorage.getItem('onboarding');
    expect(stored).toBeNull();
  });

  describe('SCM onboarding flow', () => {
    const scmOrganization = OrganizationFixture({
      features: ['onboarding-scm-experiment', 'onboarding-agentic-setup'],
    });

    // Shares scmOrganization's slug, so the mocks registered in beforeEach below
    // cover both flows. Only the messaging experiment flag differs.
    const messagingOrganization = OrganizationFixture({
      features: ['onboarding-scm-experiment', 'onboarding-scm-messaging-experiment'],
    });

    const githubProvider = GitHubIntegrationProviderFixture({
      features: ['commits'],
    });

    const nextJsPlatform = {
      key: 'javascript-nextjs' as PlatformKey,
      type: 'framework' as const,
      language: 'javascript' as const,
      category: 'browser' as const,
      name: 'Next.js',
      link: 'https://docs.sentry.io/platforms/javascript/guides/nextjs/',
    };

    const selectedMessagingSetup = {
      mode: 'selected',
      providerKey: 'slack',
      integrationId: '15',
      channelId: 'C123',
    } as const satisfies ScmMessagingSetup;

    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: `/organizations/${scmOrganization.slug}/config/integrations/`,
        body: {providers: [githubProvider]},
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${scmOrganization.slug}/integrations/`,
        body: [],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${scmOrganization.slug}/repos/`,
        body: [],
      });
      // Polled by the agentic setup while it waits for the agent to create a project
      MockApiClient.addMockResponse({
        url: `/organizations/${scmOrganization.slug}/projects/`,
        body: [],
      });
    });

    type RenderOptions = {
      initialContext?: Parameters<typeof OnboardingContextProvider>[0]['initialValue'];
    };

    function renderFlow(
      organization: Organization,
      step: string,
      options?: RenderOptions
    ) {
      return render(
        <OnboardingContextProvider initialValue={options?.initialContext}>
          <OnboardingWithoutContext />
        </OnboardingContextProvider>,
        {
          organization,
          initialRouterConfig: {
            location: {
              pathname: `/onboarding/${organization.slug}/${step}/`,
            },
            route: '/onboarding/:orgId/:step/',
          },
        }
      );
    }

    function renderOnboarding(step: string, options?: RenderOptions) {
      return renderFlow(scmOrganization, step, options);
    }

    function renderTreatmentOnboarding(step: string, options?: RenderOptions) {
      return renderFlow(messagingOrganization, step, options);
    }

    it('redirects an inactive messaging route to welcome without skipping SCM steps', async () => {
      const {router} = renderOnboarding('scm-messaging');

      await waitFor(() => {
        expect(router.location.pathname).toBe(
          `/onboarding/${scmOrganization.slug}/welcome/`
        );
      });
    });

    it('redirects treatment off the messaging step when no platform is staged', async () => {
      // The messaging step reads a platform it cannot render without. Bounce
      // back one step rather than to the start of the flow, so a refresh with
      // an empty session does not discard the repository connection.
      const {router} = renderTreatmentOnboarding('scm-messaging');

      await waitFor(() => {
        expect(router.location.pathname).toBe(
          `/onboarding/${messagingOrganization.slug}/scm-platform-features/`
        );
      });
    });

    it('navigates from welcome to scm-connect', async () => {
      const {router} = renderOnboarding('welcome');

      await userEvent.click(screen.getByTestId('onboarding-welcome-start'));
      await userEvent.click(await screen.findByRole('button', {name: 'Start setup'}));

      // Wait for scm-connect to render and its queries to resolve so the
      // mounted-effect fetches hit the mocked endpoints before afterEach
      // clears responses.
      expect(await screen.findByText('GitHub')).toBeInTheDocument();

      expect(router.location.pathname).toBe(
        `/onboarding/${scmOrganization.slug}/scm-connect/`
      );
    });

    it('shows the agent setup on start click without leaving welcome', async () => {
      const {router} = renderOnboarding('welcome');

      await userEvent.click(screen.getByTestId('onboarding-welcome-start'));

      expect(
        await screen.findByDisplayValue('npx @sentry/agent-plugin install')
      ).toBeInTheDocument();
      expect(screen.getByDisplayValue('Help me setup Sentry')).toBeInTheDocument();
      expect(screen.getByText('Connect your repository')).toBeInTheDocument();
      expect(screen.getByText('Choose your platform')).toBeInTheDocument();
      expect(screen.getByText('Install the SDK')).toBeInTheDocument();
      expect(screen.getByText('Verify your setup')).toBeInTheDocument();
      // The org has no projects yet, so the waiter is on its first milestone
      expect(await screen.findByText('Waiting for project creation')).toBeInTheDocument();
      expect(
        screen.queryByText('Detect your framework and language')
      ).not.toBeInTheDocument();

      act(() => {
        screen.getByRole('button', {name: 'What will my agent do?'}).focus();
      });

      expect(
        await screen.findByText('Detect your framework and language')
      ).toBeInTheDocument();
      expect(trackAnalytics).toHaveBeenCalledWith(
        'onboarding.scm_welcome_present_agentic_interstitial_clicked',
        expect.objectContaining({organization: scmOrganization})
      );
      expect(router.location.pathname).toBe(
        `/onboarding/${scmOrganization.slug}/welcome/`
      );
    });

    it('fires scm_welcome_step_viewed on welcome mount and not the legacy event', () => {
      renderOnboarding('welcome');

      expect(trackAnalytics).toHaveBeenCalledWith(
        'onboarding.scm_welcome_step_viewed',
        expect.objectContaining({organization: scmOrganization})
      );
      expect(trackAnalytics).not.toHaveBeenCalledWith(
        'growth.onboarding_start_onboarding',
        expect.anything()
      );
    });

    it('clears the whole session when returning to the welcome step', async () => {
      // Returning to welcome restarts the flow, so nothing is carried over —
      // including messagingSetup, which only has to survive local repository
      // and platform changes.
      sessionStorage.setItem(
        'onboarding',
        JSON.stringify({
          selectedPlatform: nextJsPlatform,
          selectedFeatures: [ProductSolution.ERROR_MONITORING],
          createdProjectSlug: 'javascript-nextjs',
          messagingSetup: selectedMessagingSetup,
          agentSetupProjectBaseline: {
            organizationId: scmOrganization.id,
            projectIds: ['1'],
          },
        })
      );

      // Render the provider bare, like production does, so it hydrates from
      // sessionStorage. Seeding `initialContext` instead makes a session clear
      // restore that value rather than empty the context.
      renderOnboarding('welcome');

      await waitFor(() => {
        expect(sessionStorage.getItem('onboarding')).toBeNull();
      });
    });

    it('goes straight to scm-connect when the agentic setup is off', async () => {
      const organization = OrganizationFixture({
        features: ['onboarding-scm-experiment'],
      });
      const {router} = renderFlow(organization, 'welcome');

      await userEvent.click(screen.getByTestId('onboarding-welcome-start'));

      expect(await screen.findByText('GitHub')).toBeInTheDocument();
      expect(router.location.pathname).toContain('/scm-connect/');
    });

    it('fires scm_welcome_continue_clicked on browser setup click and not the legacy event', async () => {
      renderOnboarding('welcome');

      await userEvent.click(screen.getByTestId('onboarding-welcome-start'));
      await userEvent.click(await screen.findByRole('button', {name: 'Start setup'}));

      expect(trackAnalytics).toHaveBeenCalledWith(
        'onboarding.scm_welcome_continue_clicked',
        expect.objectContaining({organization: scmOrganization})
      );
      expect(trackAnalytics).not.toHaveBeenCalledWith(
        'growth.onboarding_clicked_instrument_app',
        expect.anything()
      );

      // Wait for scm-connect to render and its queries to resolve so the
      // mounted-effect fetches hit the mocked endpoints before afterEach
      // clears responses.
      expect(await screen.findByText('GitHub')).toBeInTheDocument();
    });

    it('auto-selects existing integration and shows connected view', async () => {
      MockApiClient.clearMockResponses();
      MockApiClient.addMockResponse({
        url: `/organizations/${scmOrganization.slug}/config/integrations/`,
        body: {providers: [githubProvider]},
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${scmOrganization.slug}/integrations/`,
        body: [
          OrganizationIntegrationsFixture({
            id: '1',
            name: 'getsentry',
            domainName: 'github.com/getsentry',
            provider: {
              key: 'github',
              slug: 'github',
              name: 'GitHub',
              canAdd: true,
              canDisable: false,
              features: ['commits'],
              aspects: {},
            },
          }),
        ],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${scmOrganization.slug}/repos/`,
        body: [],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${scmOrganization.slug}/integrations/1/repos/`,
        body: {repos: []},
      });

      renderOnboarding('scm-connect');

      // Should auto-select the existing integration and show connected view
      expect(
        await screen.findByText('Connected to GitHub / getsentry')
      ).toBeInTheDocument();
    });

    it('continue without a repo advances to next step without skipping onboarding', async () => {
      const {router} = renderOnboarding('scm-connect');

      expect(await screen.findByText('Connect your code')).toBeInTheDocument();

      await userEvent.click(
        screen.getByRole('button', {name: 'Continue without a repo'})
      );

      await waitFor(() => {
        expect(router.location.pathname).toBe(
          `/onboarding/${scmOrganization.slug}/scm-platform-features/`
        );
      });
    });

    it('header skip button fires scm-connect analytics', async () => {
      renderOnboarding('scm-connect');

      await screen.findByText('Connect your code');

      const buttons = screen.getAllByRole('button', {name: 'Skip setup'});
      expect(buttons).toHaveLength(1);
      await userEvent.click(buttons[0]!);

      expect(trackAnalytics).toHaveBeenCalledWith(
        'onboarding.scm_header_skip_clicked',
        expect.objectContaining({
          step: 'scm-connect',
        })
      );
    });

    it('hides the welcome footer skip button in favor of the header button', () => {
      renderOnboarding('welcome');

      const buttons = screen.getAllByRole('button', {name: 'Skip setup'});
      expect(buttons).toHaveLength(1);
    });

    it('auto-creates the project on Continue and advances to setup-docs', async () => {
      ProjectsStore.loadInitialData([]);
      const controlOrganization = OrganizationFixture({
        features: ['onboarding-scm-experiment'],
      });
      const createdProject = ProjectFixture({
        platform: 'javascript-nextjs',
        slug: 'javascript-nextjs',
      });
      jest
        .spyOn(useRecentCreatedProjectHook, 'useRecentCreatedProject')
        .mockImplementation(() => ({
          project: createdProject,
          isProjectActive: false,
        }));
      MockApiClient.addMockResponse({
        url: `/organizations/${controlOrganization.slug}/`,
        body: controlOrganization,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${controlOrganization.slug}/config/integrations/`,
        body: {providers: [githubProvider]},
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${controlOrganization.slug}/integrations/`,
        body: [],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${controlOrganization.slug}/repos/`,
        body: [],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${controlOrganization.slug}/teams/`,
        body: [],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${controlOrganization.slug}/projects/`,
        body: [],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${controlOrganization.slug}/sdks/`,
        body: {},
      });
      MockApiClient.addMockResponse({
        url: `/projects/${controlOrganization.slug}/${createdProject.slug}/keys/`,
        body: [],
      });
      MockApiClient.addMockResponse({
        url: `/projects/${controlOrganization.slug}/${createdProject.slug}/issues/`,
        body: [],
      });
      MockApiClient.addMockResponse({
        url: `/projects/${controlOrganization.slug}/${createdProject.slug}/overview/`,
        body: createdProject,
      });
      const createRequest = MockApiClient.addMockResponse({
        url: `/organizations/${controlOrganization.slug}/projects/`,
        method: 'POST',
        body: createdProject,
      });

      const {router} = render(
        <OnboardingContextProvider
          initialValue={{
            selectedPlatform: nextJsPlatform,
            selectedFeatures: [ProductSolution.ERROR_MONITORING],
          }}
        >
          <OnboardingWithoutContext />
        </OnboardingContextProvider>,
        {
          organization: controlOrganization,
          initialRouterConfig: {
            location: {
              pathname: `/onboarding/${controlOrganization.slug}/scm-platform-features/`,
            },
            route: '/onboarding/:orgId/:step/',
          },
        }
      );

      await waitFor(() => {
        expect(screen.getByRole('button', {name: 'Continue'})).toBeEnabled();
      });
      await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

      await waitFor(() => {
        expect(createRequest).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(router.location.pathname).toBe(
          `/onboarding/${controlOrganization.slug}/setup-docs/`
        );
      });
    });

    it('adds the messaging route for treatment without creating a project', async () => {
      ProjectsStore.loadInitialData([]);
      MockApiClient.addMockResponse({
        url: `/organizations/${messagingOrganization.slug}/projects/`,
        body: [],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${messagingOrganization.slug}/teams/`,
        body: [],
      });
      const createRequest = MockApiClient.addMockResponse({
        url: `/organizations/${messagingOrganization.slug}/projects/`,
        method: 'POST',
        body: ProjectFixture(),
      });

      const {router} = renderTreatmentOnboarding('scm-platform-features', {
        initialContext: {
          selectedPlatform: nextJsPlatform,
          selectedFeatures: [ProductSolution.ERROR_MONITORING],
        },
      });

      await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

      expect(
        await screen.findByText('Get alerts where your team works')
      ).toBeInTheDocument();
      expect(router.location.pathname).toBe(
        `/onboarding/${messagingOrganization.slug}/scm-messaging/`
      );
      expect(createRequest).not.toHaveBeenCalled();
    });

    it('global Skip exits treatment without creating a project and clears state', async () => {
      sessionStorage.setItem(
        'onboarding',
        JSON.stringify({
          selectedPlatform: nextJsPlatform,
          selectedFeatures: [ProductSolution.ERROR_MONITORING],
          messagingSetup: {mode: 'skipped'},
        })
      );
      const createRequest = MockApiClient.addMockResponse({
        url: `/organizations/${messagingOrganization.slug}/projects/`,
        method: 'POST',
        body: ProjectFixture(),
      });

      // Render the provider bare, like production does, so it hydrates from
      // sessionStorage. Seeding `initialContext` instead makes a session clear
      // restore that value rather than empty the context.
      renderTreatmentOnboarding('scm-messaging');

      await userEvent.click(screen.getByRole('button', {name: 'Skip setup'}));

      expect(createRequest).not.toHaveBeenCalled();
      expect(sessionStorage.getItem('onboarding')).toBeNull();
    });

    describe('global Skip exit destination', () => {
      // The skip button renders in the treatment header on every step, so each
      // one has to leave the flow the same way: land on the issues stream and
      // leave no session behind for the next /onboarding visit to resume from.
      //
      // Note on the failure mode these lock in: under jsdom, reverting to
      // resetOnboarding fails the `setup-docs` and `scm-messaging` cases on the
      // destination assertion, because clearing state re-renders the step, flips
      // its validity guard and mounts a <Redirect> that beats the outbound
      // navigation. That sequence does not occur in a real browser, where the
      // click's state update and the router navigation land in one commit and
      // the step unmounts without re-rendering. The bug that is real there is
      // the session leak — see the unmount-in-same-commit test in
      // onboardingContext.spec.tsx, which reproduces it directly.
      it.each(['welcome', 'scm-connect', 'scm-platform-features'])(
        'skip from %s lands on the issues stream',
        async step => {
          sessionStorage.setItem(
            'onboarding',
            JSON.stringify({
              selectedPlatform: nextJsPlatform,
              selectedFeatures: [ProductSolution.ERROR_MONITORING],
              selectedRepository: RepositoryFixture(),
            })
          );

          const {router} = renderOnboarding(step);

          await userEvent.click(screen.getByRole('button', {name: 'Skip setup'}));

          await waitFor(() => {
            expect(router.location.pathname).toBe(
              `/organizations/${scmOrganization.slug}/issues/`
            );
          });
          expect(sessionStorage.getItem('onboarding')).toBeNull();
        }
      );

      it('skip from scm-messaging lands on the issues stream', async () => {
        sessionStorage.setItem(
          'onboarding',
          JSON.stringify({selectedPlatform: nextJsPlatform})
        );

        const {router} = renderTreatmentOnboarding('scm-messaging');

        await userEvent.click(screen.getByRole('button', {name: 'Skip setup'}));

        await waitFor(() => {
          expect(router.location.pathname).toBe(
            `/organizations/${messagingOrganization.slug}/issues/`
          );
        });
        expect(sessionStorage.getItem('onboarding')).toBeNull();
      });

      it('skip from setup-docs lands on the issues stream', async () => {
        const nextJsProject = ProjectFixture({
          platform: 'javascript-nextjs',
          id: '2',
          slug: 'javascript-nextjs',
        });

        jest
          .spyOn(useRecentCreatedProjectHook, 'useRecentCreatedProject')
          .mockImplementation(() => ({
            project: nextJsProject,
            isProjectActive: true,
          }));

        MockApiClient.addMockResponse({
          url: `/organizations/${scmOrganization.slug}/sdks/`,
          body: {},
        });
        MockApiClient.addMockResponse({
          url: `/projects/${scmOrganization.slug}/${nextJsProject.slug}/keys/`,
          body: [ProjectKeysFixture()[0]],
        });
        MockApiClient.addMockResponse({
          url: `/projects/${scmOrganization.slug}/${nextJsProject.slug}/issues/`,
          body: [],
        });

        sessionStorage.setItem(
          'onboarding',
          JSON.stringify({
            selectedPlatform: nextJsPlatform,
            selectedFeatures: [ProductSolution.ERROR_MONITORING],
            createdProjectSlug: nextJsProject.slug,
          })
        );

        const {router} = renderOnboarding('setup-docs');

        await userEvent.click(screen.getByRole('button', {name: 'Skip setup'}));

        await waitFor(() => {
          expect(router.location.pathname).toBe(
            `/organizations/${scmOrganization.slug}/issues/`
          );
        });
        expect(router.location.query.referrer).toBe('onboarding-first-event-footer-skip');
        expect(sessionStorage.getItem('onboarding')).toBeNull();
      });
    });

    it('preserves SCM context when going back from setup-docs', async () => {
      const nextJsProject = ProjectFixture({
        platform: 'javascript-nextjs',
        id: '2',
        slug: 'javascript-nextjs',
      });

      jest
        .spyOn(useRecentCreatedProjectHook, 'useRecentCreatedProject')
        .mockImplementation(() => ({
          project: nextJsProject,
          isProjectActive: false,
        }));

      MockApiClient.addMockResponse({
        url: `/organizations/${scmOrganization.slug}/sdks/`,
        body: {},
      });
      MockApiClient.addMockResponse({
        url: `/projects/${scmOrganization.slug}/${nextJsProject.slug}/keys/`,
        body: [ProjectKeysFixture()[0]],
      });
      MockApiClient.addMockResponse({
        url: `/projects/${scmOrganization.slug}/${nextJsProject.slug}/issues/`,
        body: [],
      });

      const deleteProjectMock = MockApiClient.addMockResponse({
        url: `/projects/${scmOrganization.slug}/${nextJsProject.slug}/`,
        method: 'DELETE',
      });

      const initialContext = {
        selectedPlatform: nextJsPlatform,
        selectedFeatures: [ProductSolution.ERROR_MONITORING],
        messagingSetup: selectedMessagingSetup,
      };

      // Seed sessionStorage directly so we can verify it's preserved after back
      sessionStorage.setItem('onboarding', JSON.stringify(initialContext));

      render(
        <OnboardingContextProvider initialValue={initialContext}>
          <OnboardingWithoutContext />
        </OnboardingContextProvider>,
        {
          organization: scmOrganization,
          initialRouterConfig: {
            location: {
              pathname: `/onboarding/${scmOrganization.slug}/setup-docs/`,
            },
            route: '/onboarding/:orgId/:step/',
          },
        }
      );

      await userEvent.click(screen.getByRole('button', {name: 'Back'}));

      await waitFor(() => {
        expect(deleteProjectMock).toHaveBeenCalled();
      });

      // Context should be preserved — selectedPlatform should not be cleared
      const stored = JSON.parse(sessionStorage.getItem('onboarding') ?? '{}');
      expect(stored.selectedPlatform).toBeDefined();
      expect(stored.selectedFeatures).toBeDefined();
      // createdProjectSlug should be cleared so the user can re-create
      expect(stored.createdProjectSlug).toBeUndefined();
      expect(stored.messagingSetup).toEqual(initialContext.messagingSetup);
    });

    describe('setup-docs analytics', () => {
      afterEach(() => {
        jest.restoreAllMocks();
      });

      function renderSetupDocs(project: ReturnType<typeof ProjectFixture>) {
        jest
          .spyOn(useRecentCreatedProjectHook, 'useRecentCreatedProject')
          .mockImplementation(() => ({project, isProjectActive: false}));

        MockApiClient.addMockResponse({
          url: `/organizations/${scmOrganization.slug}/sdks/`,
          body: {},
        });
        MockApiClient.addMockResponse({
          url: `/projects/${scmOrganization.slug}/${project.slug}/keys/`,
          body: [ProjectKeysFixture()[0]],
        });
        MockApiClient.addMockResponse({
          url: `/projects/${scmOrganization.slug}/${project.slug}/issues/`,
          body: [],
        });

        return render(
          <OnboardingContextProvider initialValue={{selectedPlatform: nextJsPlatform}}>
            <OnboardingWithoutContext />
          </OnboardingContextProvider>,
          {
            organization: scmOrganization,
            initialRouterConfig: {
              location: {
                pathname: `/onboarding/${scmOrganization.slug}/setup-docs/`,
              },
              route: '/onboarding/:orgId/:step/',
            },
          }
        );
      }

      it('fires scm_take_to_error_clicked on Take me to my error click', async () => {
        const project = ProjectFixture({
          platform: 'javascript-nextjs',
          slug: 'javascript-nextjs',
          firstEvent: '2026-04-21T00:00:00.000Z',
        });

        renderSetupDocs(project);

        await userEvent.click(
          await screen.findByRole('button', {name: 'Take me to my error'})
        );

        expect(trackAnalytics).toHaveBeenCalledWith(
          'onboarding.scm_take_to_error_clicked',
          expect.objectContaining({
            organization: scmOrganization,
            platform: 'javascript-nextjs',
          })
        );
        expect(trackAnalytics).not.toHaveBeenCalledWith(
          'growth.onboarding_take_to_error',
          expect.anything()
        );
      });
    });

    it('clears derived state but preserves integration and repo on repo change', () => {
      const initialContext = {
        selectedIntegration: OrganizationIntegrationsFixture({
          id: '1',
          provider: {
            key: 'github',
            slug: 'github',
            name: 'GitHub',
            canAdd: true,
            canDisable: false,
            features: ['commits'],
            aspects: {},
          },
        }),
        selectedRepository: RepositoryFixture({
          id: '42',
          name: 'getsentry/sentry',
          externalSlug: 'getsentry/sentry',
        }),
        selectedPlatform: nextJsPlatform,
        selectedFeatures: [ProductSolution.ERROR_MONITORING],
        createdProjectSlug: 'javascript-nextjs',
        messagingSetup: selectedMessagingSetup,
      };

      sessionStorage.setItem('onboarding', JSON.stringify(initialContext));

      const {result} = renderHookWithProviders(() => useOnboardingContext(), {
        organization: scmOrganization,
        additionalWrapper: ({children}) => (
          <OnboardingContextProvider initialValue={initialContext}>
            {children}
          </OnboardingContextProvider>
        ),
      });

      act(() => {
        result.current.clearDerivedState();
      });

      const stored = JSON.parse(sessionStorage.getItem('onboarding') ?? '{}');
      // Derived state should be cleared
      expect(stored.selectedPlatform).toBeUndefined();
      expect(stored.selectedFeatures).toBeUndefined();
      expect(stored.createdProjectSlug).toBeUndefined();
      // Integration and repo should be preserved
      expect(stored.selectedIntegration).toBeDefined();
      expect(stored.selectedRepository).toBeDefined();
      // Messaging destinations are organization-scoped, not repo-derived.
      expect(stored.messagingSetup).toEqual(initialContext.messagingSetup);
    });

    it('navigates back from scm-connect to welcome', async () => {
      const {router} = renderOnboarding('scm-connect');

      // Wait for the step to render
      await screen.findByText('Connect your code');

      await userEvent.click(screen.getByRole('button', {name: 'Back'}));

      await waitFor(() => {
        expect(router.location.pathname).toBe(
          `/onboarding/${scmOrganization.slug}/welcome/`
        );
      });
    });

    it('redirects the retired Project Details route to welcome', () => {
      const {router} = render(
        <OnboardingContextProvider>
          <OnboardingWithoutContext />
        </OnboardingContextProvider>,
        {
          organization: scmOrganization,
          initialRouterConfig: {
            location: {
              pathname: `/onboarding/${scmOrganization.slug}/scm-project-details/`,
            },
            route: '/onboarding/:orgId/:step/',
          },
        }
      );

      // The retired step must not render or strand a stale direct navigation.
      expect(router.location.pathname).toBe(
        `/onboarding/${scmOrganization.slug}/welcome/`
      );
    });
  });

  it('loads doc on platform click', async () => {
    const organization = OrganizationFixture();
    const nextJsProject = ProjectFixture({
      platform: 'javascript-nextjs',
      id: '2',
      slug: 'javascript-nextjs',
    });

    ProjectsStore.loadInitialData([nextJsProject]);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      body: {},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      method: 'GET',
      body: [nextJsProject],
    });

    // Mock for useRecentCreatedProject hook
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${nextJsProject.slug}/overview/`,
      body: [nextJsProject],
    });

    // Minimal mocks needed for SetupDocs to render without errors
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sdks/`,
      body: {},
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${nextJsProject.slug}/keys/`,
      method: 'GET',
      body: [ProjectKeysFixture()[0]],
    });

    MockApiClient.addMockResponse({
      url: '/projects/org-slug/javascript-react-slug/keys/',
      method: 'GET',
      body: [ProjectKeysFixture()[0]],
    });

    const {router} = render(
      <OnboardingContextProvider>
        <OnboardingWithoutContext />
      </OnboardingContextProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: `/onboarding/${organization.slug}/select-platform/`,
          },
          route: '/onboarding/:orgId/:step/',
        },
      }
    );

    // Select the Next.JS platform
    await userEvent.click(screen.getByTestId('platform-javascript-nextjs'));

    // Modal shall not be open
    expect(screen.queryByText('Do you use a framework?')).not.toBeInTheDocument();

    // Load docs for the selected platform
    await waitFor(() => {
      expect(router.location.pathname).toBe(
        `/onboarding/${organization.slug}/setup-docs/`
      );
    });
  });
});
