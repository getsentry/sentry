import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {ProjectDetailsFormState} from 'sentry/components/onboarding/onboardingContext';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {TeamStore} from 'sentry/stores/teamStore';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import {DEFAULT_ISSUE_ALERT_OPTIONS_VALUES} from 'sentry/views/projectInstall/issueAlertOptions';

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
  const organization = OrganizationFixture();
  const adminTeam = TeamFixture({slug: 'admin-team', access: ['team:admin']});

  // Seed a persisted wizard advanced to the revealed/project-selected state, as
  // if the user had created a project in this session.
  function persistRevealedWizard(overrides: Partial<Record<string, unknown>> = {}) {
    window.sessionStorage.setItem(
      WIZARD_KEY,
      JSON.stringify({
        repoStepCompleted: true,
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

  it('keeps the Create CTA available (disabled) before any steps are revealed', async () => {
    render(<ScmCreateProject />, {organization});

    expect(
      screen.queryByRole('heading', {name: 'Project details'})
    ).not.toBeInTheDocument();
    const createButton = await screen.findByRole('button', {name: 'Create project'});
    expect(createButton).toBeDisabled();
  });

  it('resets a persisted wizard on a fresh visit (no return from getting-started)', async () => {
    persistRevealedWizard();

    // No referrer/project query: not a return, so the persisted state is dropped.
    render(<ScmCreateProject />, {organization});

    await screen.findByRole('button', {name: 'Create project'});
    expect(
      screen.queryByRole('heading', {name: 'Project details'})
    ).not.toBeInTheDocument();
  });

  it('restores the wizard on a valid return from getting-started', async () => {
    const projectDetailsForm: ProjectDetailsFormState = {
      projectName: 'my-restored-name',
      teamSlug: adminTeam.slug,
    };
    persistRevealedWizard({projectDetailsForm});

    render(<ScmCreateProject />, {
      organization,
      initialRouterConfig: returningRouterConfig,
    });

    expect(
      await screen.findByRole('heading', {name: 'Project details'})
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('project-name')).toHaveValue('my-restored-name');
  });

  it('navigates to the new project getting-started on creation', async () => {
    persistRevealedWizard();

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
  });

  it('reuses the existing project on an unchanged return instead of duplicating', async () => {
    ProjectsStore.loadInitialData([
      ProjectFixture({slug: 'python', name: 'python', platform: 'python'}),
    ]);
    persistRevealedWizard({
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
});
