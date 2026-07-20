import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RepositoryFixture} from 'sentry-fixture/repository';
import {TeamFixture} from 'sentry-fixture/team';

import {
  render,
  renderHookWithProviders,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import type {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import type {ProjectDetailsFormState} from 'sentry/components/onboarding/onboardingContext';
import {useScmProjectDetails} from 'sentry/components/onboarding/scm/useScmProjectDetails';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {TeamStore} from 'sentry/stores/teamStore';
import type {Repository} from 'sentry/types/integrations';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import * as analytics from 'sentry/utils/analytics';
import {MetricValues, RuleAction} from 'sentry/views/projectInstall/issueAlertOptions';

import {ScmProjectDetails} from './scmProjectDetails';

interface StateOverrides {
  createdProjectSlug?: string;
  projectDetailsForm?: ProjectDetailsFormState;
  selectedFeatures?: ProductSolution[];
  selectedPlatform?: OnboardingSelectedSDK;
  selectedRepository?: Repository;
}

function defaultProps(state: StateOverrides = {}) {
  return {
    selectedPlatform: state.selectedPlatform,
    selectedFeatures: state.selectedFeatures,
    selectedRepository: state.selectedRepository,
    createdProjectSlug: state.createdProjectSlug,
    projectDetailsForm: state.projectDetailsForm,
    onProjectCreated: jest.fn(),
    onProjectDetailsFormChange: jest.fn(),
    onComplete: jest.fn(),
  };
}

const mockPlatform: OnboardingSelectedSDK = {
  key: 'javascript-nextjs',
  name: 'Next.js',
  language: 'javascript',
  category: 'browser',
  link: 'https://docs.sentry.io/platforms/javascript/guides/nextjs/',
  type: 'framework',
};

const mockRepository = RepositoryFixture({id: '42', name: 'getsentry/sentry'});

describe('ScmProjectDetails', () => {
  const organization = OrganizationFixture();
  const teamWithAccess = TeamFixture({slug: 'my-team', access: ['team:admin']});

  beforeEach(() => {
    TeamStore.loadInitialData([teamWithAccess]);
    ProjectsStore.loadInitialData([]);

    // useCreateNotificationAction queries messaging integrations on mount
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      body: [],
      match: [MockApiClient.matchQuery({integrationType: 'messaging'})],
    });
    // SetupMessagingIntegrationButton queries integration config
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/config/integrations/`,
      body: {providers: []},
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.restoreAllMocks();
  });

  it('renders step header with heading', async () => {
    render(<ScmProjectDetails {...defaultProps({selectedPlatform: mockPlatform})} />, {
      organization,
    });

    expect(await screen.findByText('Project details')).toBeInTheDocument();
  });

  it('renders section headers', async () => {
    render(<ScmProjectDetails {...defaultProps({selectedPlatform: mockPlatform})} />, {
      organization,
    });

    expect(await screen.findByText('Project name')).toBeInTheDocument();
    expect(screen.getByText('Team')).toBeInTheDocument();
    expect(screen.getByText('Alert frequency')).toBeInTheDocument();
    expect(screen.getByText('Get notified when things go wrong')).toBeInTheDocument();
  });

  it('renders project name defaulted from platform key', async () => {
    render(<ScmProjectDetails {...defaultProps({selectedPlatform: mockPlatform})} />, {
      organization,
    });

    const input = await screen.findByPlaceholderText('project-name');
    expect(input).toHaveValue('javascript-nextjs');
  });

  it('renders card-style alert frequency options', async () => {
    render(<ScmProjectDetails {...defaultProps({selectedPlatform: mockPlatform})} />, {
      organization,
    });

    expect(await screen.findByText('High priority issues')).toBeInTheDocument();
    expect(
      screen.getByText('Alert on new, regressed, and escalating issues')
    ).toBeInTheDocument();
    expect(screen.getByText('Custom threshold')).toBeInTheDocument();
    expect(screen.getByText("I'll set up alerts later")).toBeInTheDocument();
    expect(
      screen.getByText('You can always change alerts after project creation')
    ).toBeInTheDocument();
  });

  it('re-derives the fields when the host clears the form', () => {
    const hookProps: Parameters<typeof useScmProjectDetails>[0] = {
      analyticsFlow: 'onboarding',
      selectedPlatform: mockPlatform,
      selectedRepository: undefined,
      createdProjectSlug: undefined,
      projectDetailsForm: {
        projectName: 'restored-name',
        teamSlug: teamWithAccess.slug,
      },
      onProjectDetailsFormChange: jest.fn(),
      onComplete: jest.fn(),
    };
    const {result, rerender} = renderHookWithProviders(useScmProjectDetails, {
      organization,
      initialProps: hookProps,
    });

    expect(result.current.projectName).toBe('restored-name');

    // The host clears the form (platform or repo change in the single-view
    // flow); the name falls back to the platform default.
    rerender({...hookProps, projectDetailsForm: undefined});
    expect(result.current.projectName).toBe('javascript-nextjs');
  });

  it('create project button is disabled without platform', async () => {
    render(<ScmProjectDetails {...defaultProps()} />, {organization});

    expect(await screen.findByRole('button', {name: 'Create project'})).toBeDisabled();
  });

  it('shows a tooltip on the disabled Create button explaining what is missing', async () => {
    render(<ScmProjectDetails {...defaultProps()} />, {organization});

    const createButton = await screen.findByRole('button', {name: 'Create project'});
    expect(createButton).toBeDisabled();

    // No platform / project name: multiple required fields missing.
    await userEvent.hover(createButton);
    expect(
      await screen.findByText('Please fill out all the required fields')
    ).toBeInTheDocument();
  });

  it('create project button calls API and completes on success', async () => {
    const projectCreationRequest = MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${teamWithAccess.slug}/projects/`,
      method: 'POST',
      body: ProjectFixture({slug: 'javascript-nextjs', name: 'javascript-nextjs'}),
    });

    // Mocks for the post-creation organization refetch triggered by ProjectsStore.onCreateSuccess
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
      body: [teamWithAccess],
    });

    const props = defaultProps({selectedPlatform: mockPlatform});
    render(<ScmProjectDetails {...props} />, {organization});

    const createButton = await screen.findByRole('button', {name: 'Create project'});
    await userEvent.click(createButton);

    await waitFor(() => {
      expect(projectCreationRequest).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(props.onComplete).toHaveBeenCalled();
    });
  });

  it('stays busy while linking the repo so a second click cannot duplicate', async () => {
    const created = ProjectFixture({
      slug: 'javascript-nextjs',
      name: 'javascript-nextjs',
    });
    const createRequest = MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${teamWithAccess.slug}/projects/`,
      method: 'POST',
      body: created,
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
      body: [teamWithAccess],
    });

    // The repo link runs after the project POST resolves, i.e. while the create
    // mutation is no longer pending. Delaying it holds the flow in exactly the
    // window where the button used to re-enable and accept a duplicate create.
    // The delay must comfortably exceed userEvent's inter-click time so a loaded
    // CI runner can't let it elapse mid-second-click and re-enable the button.
    const repoLinkRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${created.slug}/repo/`,
      method: 'POST',
      body: {
        id: '1',
        projectId: created.id,
        repositoryId: mockRepository.id,
        source: 'scm_onboarding',
        created: true,
      },
      asyncDelay: 1000,
    });

    const props = defaultProps({
      selectedPlatform: mockPlatform,
      selectedRepository: mockRepository,
    });
    render(<ScmProjectDetails {...props} />, {organization});

    const createButton = await screen.findByRole('button', {name: 'Create project'});
    await userEvent.click(createButton);

    // Project POST resolved, repo link still in flight: the button must remain
    // disabled, so this second click is a no-op.
    expect(createButton).toBeDisabled();
    await userEvent.click(createButton);

    // Completion only fires once the delayed repo link resolves, so give the
    // wait headroom over the asyncDelay above.
    await waitFor(
      () => {
        expect(props.onComplete).toHaveBeenCalledTimes(1);
      },
      {timeout: 5000}
    );
    expect(createRequest).toHaveBeenCalledTimes(1);
    expect(repoLinkRequest).toHaveBeenCalledTimes(1);
  });

  it('links selected repository to project after creation', async () => {
    const createdProject = ProjectFixture({
      slug: 'javascript-nextjs',
      name: 'javascript-nextjs',
    });

    MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${teamWithAccess.slug}/projects/`,
      method: 'POST',
      body: createdProject,
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
      body: [teamWithAccess],
    });

    const repoLinkRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${createdProject.slug}/repo/`,
      method: 'POST',
      body: {
        id: '1',
        projectId: createdProject.id,
        repositoryId: mockRepository.id,
        source: 'scm_onboarding',
        created: true,
      },
    });

    const props = defaultProps({
      selectedPlatform: mockPlatform,
      selectedRepository: mockRepository,
    });
    render(<ScmProjectDetails {...props} />, {organization});

    await userEvent.click(await screen.findByRole('button', {name: 'Create project'}));

    await waitFor(() => {
      expect(props.onComplete).toHaveBeenCalled();
    });

    expect(repoLinkRequest).toHaveBeenCalledWith(
      `/projects/${organization.slug}/${createdProject.slug}/repo/`,
      expect.objectContaining({
        method: 'POST',
        data: {repositoryId: mockRepository.id},
      })
    );
  });

  it('defaults team selector to first admin team', async () => {
    render(<ScmProjectDetails {...defaultProps({selectedPlatform: mockPlatform})} />, {
      organization,
    });

    // TeamSelector renders the team slug as the selected value
    expect(await screen.findByText(`#${teamWithAccess.slug}`)).toBeInTheDocument();
  });

  it('stores project slug via onProjectCreated after creation', async () => {
    const createdProject = ProjectFixture({
      slug: 'my-custom-project',
      name: 'my-custom-project',
    });

    MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${teamWithAccess.slug}/projects/`,
      method: 'POST',
      body: createdProject,
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
      body: [teamWithAccess],
    });

    const props = defaultProps({selectedPlatform: mockPlatform});
    render(<ScmProjectDetails {...props} />, {organization});

    await userEvent.click(await screen.findByRole('button', {name: 'Create project'}));

    await waitFor(() => {
      expect(props.onComplete).toHaveBeenCalled();
    });

    expect(props.onProjectCreated).toHaveBeenCalledWith('my-custom-project');
  });

  it('restores form inputs from projectDetailsForm prop', async () => {
    render(
      <ScmProjectDetails
        {...defaultProps({
          selectedPlatform: mockPlatform,
          projectDetailsForm: {
            projectName: 'my-saved-name',
            teamSlug: teamWithAccess.slug,
          },
        })}
      />,
      {organization}
    );

    const input = await screen.findByPlaceholderText('project-name');
    expect(input).toHaveValue('my-saved-name');
  });

  it('persists form state on successful creation', async () => {
    MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${teamWithAccess.slug}/projects/`,
      method: 'POST',
      body: ProjectFixture({slug: 'javascript-nextjs', name: 'javascript-nextjs'}),
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
      body: [teamWithAccess],
    });

    const props = defaultProps({selectedPlatform: mockPlatform});
    render(<ScmProjectDetails {...props} />, {organization});

    await userEvent.click(await screen.findByRole('button', {name: 'Create project'}));

    await waitFor(() => {
      expect(props.onComplete).toHaveBeenCalled();
    });

    expect(props.onProjectDetailsFormChange).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: 'javascript-nextjs',
        teamSlug: teamWithAccess.slug,
      })
    );
  });

  it('reuses existing project when nothing changed on back-nav', async () => {
    const trackAnalyticsSpy = jest.spyOn(analytics, 'trackAnalytics');
    const existingProject = ProjectFixture({
      slug: 'javascript-nextjs',
      name: 'javascript-nextjs',
      platform: 'javascript-nextjs',
    });
    ProjectsStore.loadInitialData([existingProject]);

    const createRequest = MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${teamWithAccess.slug}/projects/`,
      method: 'POST',
      body: existingProject,
    });

    const props = defaultProps({
      selectedPlatform: mockPlatform,
      createdProjectSlug: existingProject.slug,
      projectDetailsForm: {
        projectName: 'javascript-nextjs',
        teamSlug: teamWithAccess.slug,
        alertRuleConfig: {
          alertSetting: RuleAction.DEFAULT_ALERT,
          interval: '1m',
          metric: MetricValues.ERRORS,
          threshold: '10',
        },
      },
    });
    render(<ScmProjectDetails {...props} />, {organization});

    await userEvent.click(await screen.findByRole('button', {name: 'Create project'}));

    await waitFor(() => {
      expect(props.onComplete).toHaveBeenCalled();
    });
    expect(createRequest).not.toHaveBeenCalled();
    expect(trackAnalyticsSpy).toHaveBeenCalledWith(
      'onboarding.scm_project_details_create_succeeded',
      expect.objectContaining({project_slug: existingProject.slug})
    );
  });

  it('creates a new project when the user edits after restoring form state', async () => {
    const existingProject = ProjectFixture({
      slug: 'javascript-nextjs',
      name: 'javascript-nextjs',
    });
    ProjectsStore.loadInitialData([existingProject]);

    const createRequest = MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${teamWithAccess.slug}/projects/`,
      method: 'POST',
      body: ProjectFixture({slug: 'renamed-project', name: 'renamed-project'}),
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
      body: [teamWithAccess],
    });

    const props = defaultProps({
      selectedPlatform: mockPlatform,
      createdProjectSlug: existingProject.slug,
      projectDetailsForm: {
        projectName: 'javascript-nextjs',
        teamSlug: teamWithAccess.slug,
        alertRuleConfig: {
          alertSetting: RuleAction.DEFAULT_ALERT,
          interval: '1m',
          metric: MetricValues.ERRORS,
          threshold: '10',
        },
      },
    });
    render(<ScmProjectDetails {...props} />, {organization});

    const input = await screen.findByPlaceholderText('project-name');
    await userEvent.clear(input);
    await userEvent.type(input, 'renamed-project');

    await userEvent.click(screen.getByRole('button', {name: 'Create project'}));

    await waitFor(() => {
      expect(createRequest).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(props.onComplete).toHaveBeenCalled();
    });
  });

  it('creates a new project when the stored project has a different platform', async () => {
    const stalePythonProject = ProjectFixture({
      slug: 'javascript-nextjs',
      name: 'javascript-nextjs',
      platform: 'python',
    });
    ProjectsStore.loadInitialData([stalePythonProject]);

    const createRequest = MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${teamWithAccess.slug}/projects/`,
      method: 'POST',
      body: ProjectFixture({
        slug: 'javascript-nextjs',
        name: 'javascript-nextjs',
        platform: 'javascript-nextjs',
      }),
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
      body: [teamWithAccess],
    });

    const props = defaultProps({
      selectedPlatform: mockPlatform,
      createdProjectSlug: stalePythonProject.slug,
      projectDetailsForm: {
        projectName: 'javascript-nextjs',
        teamSlug: teamWithAccess.slug,
        alertRuleConfig: {
          alertSetting: RuleAction.DEFAULT_ALERT,
          interval: '1m',
          metric: MetricValues.ERRORS,
          threshold: '10',
        },
      },
    });
    render(<ScmProjectDetails {...props} />, {organization});

    await userEvent.click(await screen.findByRole('button', {name: 'Create project'}));

    await waitFor(() => {
      expect(createRequest).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(props.onComplete).toHaveBeenCalled();
    });
  });

  it('creates a new project when the stored project is missing from the store', async () => {
    // ProjectsStore is empty (initialized in beforeEach), so a stale
    // createdProjectSlug can't match and reuse is skipped.
    const createRequest = MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${teamWithAccess.slug}/projects/`,
      method: 'POST',
      body: ProjectFixture({slug: 'javascript-nextjs', name: 'javascript-nextjs'}),
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
      body: [teamWithAccess],
    });

    const props = defaultProps({
      selectedPlatform: mockPlatform,
      createdProjectSlug: 'javascript-nextjs',
      projectDetailsForm: {
        projectName: 'javascript-nextjs',
        teamSlug: teamWithAccess.slug,
        alertRuleConfig: {
          alertSetting: RuleAction.DEFAULT_ALERT,
          interval: '1m',
          metric: MetricValues.ERRORS,
          threshold: '10',
        },
      },
    });
    render(<ScmProjectDetails {...props} />, {organization});

    await userEvent.click(await screen.findByRole('button', {name: 'Create project'}));

    await waitFor(() => {
      expect(createRequest).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(props.onComplete).toHaveBeenCalled();
    });
  });

  it('shows error message on project creation failure', async () => {
    MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${teamWithAccess.slug}/projects/`,
      method: 'POST',
      statusCode: 500,
      body: {detail: 'Internal Error'},
    });

    const props = defaultProps({selectedPlatform: mockPlatform});
    render(<ScmProjectDetails {...props} />, {organization});

    const createButton = await screen.findByRole('button', {name: 'Create project'});
    await userEvent.click(createButton);

    await waitFor(() => {
      expect(props.onComplete).not.toHaveBeenCalled();
    });
  });

  it('fires step viewed analytics on mount', async () => {
    const trackAnalyticsSpy = jest.spyOn(analytics, 'trackAnalytics');

    render(<ScmProjectDetails {...defaultProps({selectedPlatform: mockPlatform})} />, {
      organization,
    });

    await screen.findByText('Project details');

    expect(trackAnalyticsSpy).toHaveBeenCalledWith(
      'onboarding.scm_project_details_step_viewed',
      expect.objectContaining({organization})
    );
  });

  it('fires create analytics on successful project creation', async () => {
    const trackAnalyticsSpy = jest.spyOn(analytics, 'trackAnalytics');

    MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${teamWithAccess.slug}/projects/`,
      method: 'POST',
      body: ProjectFixture({slug: 'javascript-nextjs', name: 'javascript-nextjs'}),
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
      body: [teamWithAccess],
    });

    const props = defaultProps({selectedPlatform: mockPlatform});
    render(<ScmProjectDetails {...props} />, {organization});

    await userEvent.click(await screen.findByRole('button', {name: 'Create project'}));

    await waitFor(() => {
      expect(props.onComplete).toHaveBeenCalled();
    });

    const eventKeys = trackAnalyticsSpy.mock.calls.map(call => call[0]);
    expect(eventKeys).toContain('onboarding.scm_project_details_create_clicked');
    expect(eventKeys).toContain('onboarding.scm_project_details_create_succeeded');
  });
});
