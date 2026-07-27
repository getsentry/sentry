import {DetectedPlatformFixture} from 'sentry-fixture/detectedPlatform';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';
import {ProjectFixture} from 'sentry-fixture/project';
import {RepositoryFixture} from 'sentry-fixture/repository';
import {TeamFixture} from 'sentry-fixture/team';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import type {ProjectDetailsFormState} from 'sentry/components/onboarding/onboardingContext';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {TeamStore} from 'sentry/stores/teamStore';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {PlatformKey} from 'sentry/types/platform';
import {DEFAULT_ISSUE_ALERT_OPTIONS_VALUES} from 'sentry/views/projectInstall/issueAlertOptions';
import {RouteAnalyticsContext} from 'sentry/views/routeAnalyticsContextProvider';

import {ScmCreateProject} from './scmCreateProject';

// Mock the virtualizer so the platform-features manual-picker Select renders.
jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: jest.fn(({count}) => ({
    getVirtualItems: () =>
      Array.from({length: count}, (_, i) => ({
        key: i,
        index: i,
        start: i * 36,
        size: 36,
      })),
    getTotalSize: () => count * 36,
    measureElement: jest.fn(),
  })),
}));

jest.mock('sentry/data/platforms', () => {
  const actual = jest.requireActual('sentry/data/platforms');
  return {
    ...actual,
    platforms: actual.platforms.filter(
      (p: {id: string}) => p.id === 'python' || p.id === 'javascript'
    ),
  };
});

const WIZARD_KEY = 'project-creation-wizard';
const CREATED_PROJECT_ID = 'created-1';

const pythonPlatform: OnboardingSelectedSDK = {
  key: 'python',
  name: 'Python',
  language: 'python',
  type: 'language',
  link: 'https://docs.sentry.io/platforms/python/',
  category: 'popular',
};

describe('ScmCreateProject', () => {
  const organization = OrganizationFixture({features: ['performance-view']});
  const adminTeam = TeamFixture({slug: 'admin-team', access: ['team:admin']});
  const githubIntegration = OrganizationIntegrationsFixture({
    id: '1',
    name: 'getsentry',
    status: 'active',
    organizationIntegrationStatus: 'active',
    provider: {
      key: 'github',
      slug: 'github',
      name: 'GitHub',
      canAdd: true,
      canDisable: false,
      features: ['commits'],
      aspects: {},
    },
  });
  const githubRepository = RepositoryFixture({
    id: 'repository-1',
    externalId: '1',
    name: 'getsentry/sentry',
    externalSlug: 'getsentry/sentry',
    integrationId: githubIntegration.id,
    provider: {id: 'integrations:github', name: 'GitHub'},
  });

  // Seed a persisted wizard for a project created in this session.
  function persistWizardSession(overrides: Partial<Record<string, unknown>> = {}) {
    window.sessionStorage.setItem(
      WIZARD_KEY,
      JSON.stringify({
        selectedPlatform: pythonPlatform,
        createdProjectId: CREATED_PROJECT_ID,
        ...overrides,
      })
    );
  }

  // A return from getting-started for the created project: referrer + matching id.
  const returningRouterConfig = {
    location: {
      pathname: '/organizations/org-slug/projects/new/',
      query: {referrer: 'getting-started', project: CREATED_PROJECT_ID},
    },
  };

  function mockProjectCreation(projectSlug: string, platform: PlatformKey) {
    const project = ProjectFixture({
      id: `${projectSlug}-id`,
      slug: projectSlug,
      name: projectSlug,
      platform,
    });
    const createRequest = MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${adminTeam.slug}/projects/`,
      method: 'POST',
      body: project,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      body: organization,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/teams/`,
      body: [adminTeam],
    });
    return {createRequest, project};
  }

  function mockExistingGithubRepository() {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      body: [githubIntegration],
      match: [MockApiClient.matchQuery({integrationType: 'source_code_management'})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${githubIntegration.id}/repos/`,
      body: {
        repos: [
          {
            externalId: githubRepository.externalId,
            identifier: githubRepository.externalSlug,
            name: 'sentry',
            isInstalled: true,
          },
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body: [githubRepository],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/${githubRepository.id}/platforms/`,
      body: {
        platforms: [DetectedPlatformFixture({platform: 'python'})],
      },
    });
    return MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/python/repo/`,
      method: 'POST',
      body: {},
    });
  }

  beforeEach(() => {
    TeamStore.reset();
    TeamStore.loadInitialData([adminTeam]);
    ProjectsStore.loadInitialData([]);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/config/integrations/`,
      body: {providers: []},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/user-teams/`,
      body: [adminTeam],
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    window.sessionStorage.clear();
    jest.clearAllMocks();
  });

  function renderScmWithOriginQuery(query: Record<string, string> = {}) {
    const routeAnalytics = {
      previousUrl: '',
      setDisableRouteAnalytics: jest.fn(),
      setEventNames: jest.fn(),
      setOrganization: jest.fn(),
      setRouteAnalyticsParams: jest.fn(),
    };

    render(
      <RouteAnalyticsContext value={routeAnalytics}>
        <ScmCreateProject />
      </RouteAnalyticsContext>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/projects/new/',
            query,
          },
        },
      }
    );

    return {routeAnalytics};
  }

  it('sets page-view origin to org_creation from the org-create seed param', () => {
    const {routeAnalytics} = renderScmWithOriginQuery({
      projectCreationOrigin: 'org_creation',
    });

    expect(routeAnalytics.setEventNames).toHaveBeenCalledWith(
      'project_creation_page.viewed',
      'Project Create: Creation page viewed'
    );
    expect(routeAnalytics.setRouteAnalyticsParams).toHaveBeenCalledWith({
      variant: 'scm',
      origin: 'org_creation',
    });
  });

  it('keeps org_creation origin sticky after getting-started autofill return', () => {
    window.sessionStorage.setItem('project-creation-origin:org-slug', 'org_creation');

    const {routeAnalytics} = renderScmWithOriginQuery({
      referrer: 'getting-started',
      project: CREATED_PROJECT_ID,
    });
    expect(routeAnalytics.setRouteAnalyticsParams).toHaveBeenCalledWith({
      variant: 'scm',
      origin: 'org_creation',
    });
  });

  it('defaults page-view origin to existing_org without a seed', () => {
    const {routeAnalytics} = renderScmWithOriginQuery();

    expect(routeAnalytics.setRouteAnalyticsParams).toHaveBeenCalledWith({
      variant: 'scm',
      origin: 'existing_org',
    });
  });

  it('does not treat getting-started referrer alone as org creation', () => {
    const {routeAnalytics} = renderScmWithOriginQuery({
      referrer: 'getting-started',
      project: CREATED_PROJECT_ID,
    });

    expect(routeAnalytics.setRouteAnalyticsParams).toHaveBeenCalledWith({
      variant: 'scm',
      origin: 'existing_org',
    });
  });
  it('shows all steps with the Create CTA disabled on a fresh visit', async () => {
    render(<ScmCreateProject />, {organization});

    // All sections render up front (no progressive disclosure): the repository,
    // platform, and project-details sections are all present at once.
    expect(await screen.findByRole('heading', {name: 'Repository'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Platform'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Project name'})).toBeInTheDocument();

    // Nothing is filled in yet, so the primary action stays disabled.
    expect(screen.getByRole('button', {name: 'Create project'})).toBeDisabled();
  });

  it('shows a tooltip on the disabled Create CTA explaining what is missing', async () => {
    render(<ScmCreateProject />, {organization});

    const createButton = await screen.findByRole('button', {name: 'Create project'});
    expect(createButton).toBeDisabled();

    // Fresh wizard: platform and project name are both missing.
    await userEvent.hover(createButton);
    expect(
      await screen.findByText('Please fill out all the required fields')
    ).toBeInTheDocument();
  });

  it('drops a persisted wizard on a fresh visit (no return from getting-started)', async () => {
    persistWizardSession({projectDetailsForm: {projectName: 'my-restored-name'}});

    // No referrer/project query: not a return, so the persisted state is dropped.
    render(<ScmCreateProject />, {organization});

    await screen.findByRole('button', {name: 'Create project'});
    // The restored name is not applied; the field falls back to its default.
    expect(screen.queryByDisplayValue('my-restored-name')).not.toBeInTheDocument();
  });

  it('restores the wizard on a valid return from getting-started', async () => {
    const projectDetailsForm: ProjectDetailsFormState = {
      projectName: 'my-restored-name',
      teamSlug: adminTeam.slug,
    };
    persistWizardSession({projectDetailsForm});

    render(<ScmCreateProject />, {
      organization,
      initialRouterConfig: returningRouterConfig,
    });

    expect(
      await screen.findByRole('heading', {name: 'Project name'})
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('project-name')).toHaveValue('my-restored-name');
  });

  it('restores the wizard when the return params arrive after mount', async () => {
    const projectDetailsForm: ProjectDetailsFormState = {
      projectName: 'my-restored-name',
      teamSlug: adminTeam.slug,
    };
    persistWizardSession({projectDetailsForm});

    // The back nav from getting-started can land here bare before its replace
    // navigation appends the referrer/project params (see ScmCreateProject).
    const {router} = render(<ScmCreateProject />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/projects/new/'},
      },
    });

    await screen.findByRole('button', {name: 'Create project'});
    // Not a return yet, so the persisted form is not restored.
    expect(screen.queryByDisplayValue('my-restored-name')).not.toBeInTheDocument();

    router.navigate(
      `/organizations/org-slug/projects/new/?referrer=getting-started&project=${CREATED_PROJECT_ID}`,
      {replace: true}
    );

    // The late-arriving params remount the wizard and restore the form.
    expect(await screen.findByDisplayValue('my-restored-name')).toBeInTheDocument();
  });

  it('navigates to the new project getting-started on creation', async () => {
    persistWizardSession();

    const createRequest = MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${adminTeam.slug}/projects/`,
      method: 'POST',
      body: ProjectFixture({slug: 'python', name: 'python'}),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      body: organization,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/teams/`,
      body: [adminTeam],
    });

    const {router} = render(<ScmCreateProject />, {
      organization,
      initialRouterConfig: returningRouterConfig,
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Create project'}));

    await waitFor(() => {
      expect(createRequest).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(router.location.pathname).toContain('/python/getting-started/');
    });
    expect(router.location.query.projectCreationVariant).toBe('scm');
  });

  it('forwards the selected products to getting-started as the product query', async () => {
    persistWizardSession({
      selectedFeatures: [
        ProductSolution.PERFORMANCE_MONITORING,
        ProductSolution.SESSION_REPLAY,
      ],
    });

    MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${adminTeam.slug}/projects/`,
      method: 'POST',
      body: ProjectFixture({slug: 'python', name: 'python'}),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      body: organization,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/teams/`,
      body: [adminTeam],
    });

    const {router} = render(<ScmCreateProject />, {
      organization,
      initialRouterConfig: returningRouterConfig,
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Create project'}));

    await waitFor(() => {
      expect(router.location.pathname).toContain('/python/getting-started/');
    });
    // The upfront product selection seeds the setup docs via the product query.
    expect(router.location.query.product).toEqual([
      ProductSolution.PERFORMANCE_MONITORING,
      ProductSolution.SESSION_REPLAY,
    ]);
    expect(router.location.query.projectCreationVariant).toBe('scm');
  });

  it('forwards synced-back product selection to getting-started on the next project creation', async () => {
    // Simulate a round-trip: getting-started already patched selectedFeatures in
    // the session via useScmCreateProjectProductSync. On return, the wizard reads
    // the updated selection from session and forwards it to getting-started again.
    persistWizardSession({
      selectedFeatures: [
        ProductSolution.PERFORMANCE_MONITORING,
        ProductSolution.SESSION_REPLAY,
      ],
      projectDetailsForm: {projectName: 'my-project', teamSlug: adminTeam.slug},
    });

    MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${adminTeam.slug}/projects/`,
      method: 'POST',
      body: ProjectFixture({slug: 'python', name: 'python'}),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      body: organization,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/teams/`,
      body: [adminTeam],
    });

    const {router} = render(<ScmCreateProject />, {
      organization,
      initialRouterConfig: returningRouterConfig,
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Create project'}));

    await waitFor(() => {
      expect(router.location.pathname).toContain('/python/getting-started/');
    });
    // The synced-back selection is forwarded through the product query, closing
    // the round-trip.
    expect(router.location.query.product).toEqual([
      ProductSolution.PERFORMANCE_MONITORING,
      ProductSolution.SESSION_REPLAY,
    ]);
  });

  it('reuses the existing project on an unchanged return instead of duplicating', async () => {
    ProjectsStore.loadInitialData([
      ProjectFixture({slug: 'python', name: 'python', platform: 'python'}),
    ]);
    persistWizardSession({
      createdProjectSlug: 'python',
      projectDetailsForm: {
        projectName: 'python',
        teamSlug: adminTeam.slug,
        alertRuleConfig: DEFAULT_ISSUE_ALERT_OPTIONS_VALUES,
      },
    });

    const createRequest = MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${adminTeam.slug}/projects/`,
      method: 'POST',
      body: ProjectFixture({slug: 'python', name: 'python'}),
    });

    const {router} = render(<ScmCreateProject />, {
      organization,
      initialRouterConfig: returningRouterConfig,
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Create project'}));

    await waitFor(() => {
      expect(router.location.pathname).toContain('/python/getting-started/');
    });
    expect(createRequest).not.toHaveBeenCalled();
  });

  it('creates from fresh manual selections and persists the completed state', async () => {
    const {createRequest, project} = mockProjectCreation('fresh-project', 'python');
    renderGlobalModal();
    const {router} = render(<ScmCreateProject />, {organization});

    await userEvent.click(await screen.findByText('Search SDKs...'));
    await userEvent.keyboard('Python');
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Python'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Configure SDK'}));

    const projectName = await screen.findByPlaceholderText('project-name');
    await waitFor(() => expect(projectName).toHaveValue('python'));
    const tracing = screen.getByRole('checkbox', {name: /Tracing/});
    await userEvent.click(tracing);
    expect(tracing).toBeChecked();
    await userEvent.clear(projectName);
    await userEvent.type(projectName, project.slug);

    await userEvent.click(screen.getByRole('button', {name: 'Create project'}));

    await waitFor(() => {
      expect(createRequest).toHaveBeenCalledWith(
        `/teams/${organization.slug}/${adminTeam.slug}/projects/`,
        expect.objectContaining({
          data: expect.objectContaining({name: project.slug, platform: project.platform}),
        })
      );
    });
    await waitFor(() => {
      expect(router.location.pathname).toContain(`/${project.slug}/getting-started/`);
    });
    expect(router.location.query.product).toEqual([
      ProductSolution.ERROR_MONITORING,
      ProductSolution.PERFORMANCE_MONITORING,
    ]);

    const savedState = JSON.parse(window.sessionStorage.getItem(WIZARD_KEY)!);
    expect(savedState).toEqual(
      expect.objectContaining({
        selectedPlatform: expect.objectContaining({key: 'python'}),
        selectedFeatures: [
          ProductSolution.ERROR_MONITORING,
          ProductSolution.PERFORMANCE_MONITORING,
        ],
        projectDetailsForm: expect.objectContaining({
          projectName: project.slug,
          teamSlug: adminTeam.slug,
        }),
        createdProjectId: project.id,
        createdProjectSlug: project.slug,
      })
    );
    expect(savedState).not.toHaveProperty('selectedRepository');
  });

  it('creates from an existing integration and detected repository platform', async () => {
    const repoLinkRequest = mockExistingGithubRepository();
    const {createRequest, project} = mockProjectCreation('python', 'python');
    const {router} = render(<ScmCreateProject />, {organization});

    expect(await screen.findByRole('button', {name: /getsentry/})).toBeInTheDocument();
    await userEvent.click(screen.getByText('Search repositories'));
    await userEvent.keyboard('sentry');
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'sentry'}));

    expect(await screen.findByRole('radio', {name: 'Python Language'})).toBeChecked();
    await waitFor(() => {
      expect(screen.getByPlaceholderText('project-name')).toHaveValue('python');
    });
    expect(screen.getByRole('button', {name: 'Create project'})).toBeEnabled();

    await userEvent.click(screen.getByRole('button', {name: 'Create project'}));

    await waitFor(() => {
      expect(createRequest).toHaveBeenCalledWith(
        `/teams/${organization.slug}/${adminTeam.slug}/projects/`,
        expect.objectContaining({
          data: expect.objectContaining({name: project.slug, platform: project.platform}),
        })
      );
    });
    await waitFor(() => {
      expect(repoLinkRequest).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${project.slug}/repo/`,
        expect.objectContaining({
          method: 'POST',
          data: {repositoryId: githubRepository.id},
        })
      );
    });
    await waitFor(() => {
      expect(router.location.pathname).toContain(`/${project.slug}/getting-started/`);
    });
    expect(JSON.parse(window.sessionStorage.getItem(WIZARD_KEY)!)).toEqual(
      expect.objectContaining({
        selectedRepository: expect.objectContaining({id: githubRepository.id}),
        selectedPlatform: expect.objectContaining({key: 'python'}),
        projectDetailsForm: expect.objectContaining({
          projectName: project.slug,
          teamSlug: adminTeam.slug,
        }),
      })
    );
  });

  it('clears repository-derived state when the selected repository is removed', async () => {
    mockExistingGithubRepository();
    renderGlobalModal();
    render(<ScmCreateProject />, {organization});

    await userEvent.click(await screen.findByText('Search repositories'));
    await userEvent.keyboard('sentry');
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'sentry'}));

    expect(await screen.findByRole('radio', {name: 'Python Language'})).toBeChecked();
    await waitFor(() => {
      expect(screen.getByPlaceholderText('project-name')).toHaveValue('python');
    });
    expect(screen.getByRole('button', {name: 'Create project'})).toBeEnabled();
    const tracing = await screen.findByRole('checkbox', {name: /Tracing/});
    await userEvent.click(tracing);
    expect(tracing).toBeChecked();

    await userEvent.click(screen.getByText('sentry'));
    await userEvent.keyboard('{Backspace}');

    expect(await screen.findByText('Search SDKs...')).toBeInTheDocument();
    expect(
      screen.queryByRole('radio', {name: 'Python Language'})
    ).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('project-name')).toHaveValue('');
    expect(screen.getByRole('button', {name: 'Create project'})).toBeDisabled();
    await userEvent.click(screen.getByText('Search SDKs...'));
    await userEvent.keyboard('Python');
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Python'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Configure SDK'}));

    expect(await screen.findByRole('checkbox', {name: /Tracing/})).not.toBeChecked();
  });
});
