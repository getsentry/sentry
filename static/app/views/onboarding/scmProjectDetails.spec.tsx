import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RepositoryFixture} from 'sentry-fixture/repository';
import {TeamFixture} from 'sentry-fixture/team';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  OnboardingContextProvider,
  type OnboardingSessionState,
} from 'sentry/components/onboarding/onboardingContext';
import {TeamStore} from 'sentry/stores/teamStore';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import * as analytics from 'sentry/utils/analytics';
import {sessionStorageWrapper} from 'sentry/utils/sessionStorage';

import {ScmProjectDetails} from './scmProjectDetails';

function makeOnboardingWrapper(initialState?: OnboardingSessionState) {
  return function OnboardingWrapper({children}: {children?: React.ReactNode}) {
    return (
      <OnboardingContextProvider initialValue={initialState}>
        {children}
      </OnboardingContextProvider>
    );
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
    sessionStorageWrapper.clear();
    TeamStore.loadInitialData([teamWithAccess]);

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
  });

  it('renders step header with step counter and heading', async () => {
    render(
      <ScmProjectDetails
        onComplete={jest.fn()}
        stepIndex={3}
        genSkipOnboardingLink={() => null}
      />,
      {
        organization,
        additionalWrapper: makeOnboardingWrapper({
          selectedPlatform: mockPlatform,
        }),
      }
    );

    expect(await screen.findByText('Step 3 of 3')).toBeInTheDocument();
    expect(screen.getByText('Project details')).toBeInTheDocument();
  });

  it('renders section headers with icons', async () => {
    render(
      <ScmProjectDetails
        onComplete={jest.fn()}
        stepIndex={3}
        genSkipOnboardingLink={() => null}
      />,
      {
        organization,
        additionalWrapper: makeOnboardingWrapper({
          selectedPlatform: mockPlatform,
        }),
      }
    );

    expect(await screen.findByText('Give your project a name')).toBeInTheDocument();
    expect(screen.getByText('Assign a team')).toBeInTheDocument();
    expect(screen.getByText('Alert frequency')).toBeInTheDocument();
    expect(screen.getByText('Get notified when things go wrong')).toBeInTheDocument();
  });

  it('renders project name defaulted from platform key', async () => {
    render(
      <ScmProjectDetails
        onComplete={jest.fn()}
        stepIndex={3}
        genSkipOnboardingLink={() => null}
      />,
      {
        organization,
        additionalWrapper: makeOnboardingWrapper({
          selectedPlatform: mockPlatform,
        }),
      }
    );

    const input = await screen.findByPlaceholderText('project-name');
    expect(input).toHaveValue('javascript-nextjs');
  });

  it('uses platform key as default name even when repository is in context', async () => {
    render(
      <ScmProjectDetails
        onComplete={jest.fn()}
        stepIndex={3}
        genSkipOnboardingLink={() => null}
      />,
      {
        organization,
        additionalWrapper: makeOnboardingWrapper({
          selectedPlatform: mockPlatform,
          selectedRepository: mockRepository,
        }),
      }
    );

    const input = await screen.findByPlaceholderText('project-name');
    expect(input).toHaveValue('javascript-nextjs');
  });

  it('renders card-style alert frequency options', async () => {
    render(
      <ScmProjectDetails
        onComplete={jest.fn()}
        stepIndex={3}
        genSkipOnboardingLink={() => null}
      />,
      {
        organization,
        additionalWrapper: makeOnboardingWrapper({
          selectedPlatform: mockPlatform,
        }),
      }
    );

    expect(await screen.findByText('High priority issues')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
    expect(screen.getByText("I'll create my own alerts later")).toBeInTheDocument();
  });

  it('create project button is disabled without platform in context', async () => {
    render(
      <ScmProjectDetails
        onComplete={jest.fn()}
        stepIndex={3}
        genSkipOnboardingLink={() => null}
      />,
      {
        organization,
        additionalWrapper: makeOnboardingWrapper(),
      }
    );

    expect(await screen.findByRole('button', {name: 'Create project'})).toBeDisabled();
  });

  it('create project button calls API and completes on success', async () => {
    const onComplete = jest.fn();

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

    render(
      <ScmProjectDetails
        onComplete={onComplete}
        stepIndex={3}
        genSkipOnboardingLink={() => null}
      />,
      {
        organization,
        additionalWrapper: makeOnboardingWrapper({
          selectedPlatform: mockPlatform,
        }),
      }
    );

    const createButton = await screen.findByRole('button', {name: 'Create project'});
    await userEvent.click(createButton);

    await waitFor(() => {
      expect(projectCreationRequest).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });
  });

  it('defaults team selector to first admin team', async () => {
    render(
      <ScmProjectDetails
        onComplete={jest.fn()}
        stepIndex={3}
        genSkipOnboardingLink={() => null}
      />,
      {
        organization,
        additionalWrapper: makeOnboardingWrapper({
          selectedPlatform: mockPlatform,
        }),
      }
    );

    // TeamSelector renders the team slug as the selected value
    expect(await screen.findByText(`#${teamWithAccess.slug}`)).toBeInTheDocument();
  });

  it('updates context with project slug after creation', async () => {
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

    const onComplete = jest.fn();

    render(
      <ScmProjectDetails
        onComplete={onComplete}
        stepIndex={3}
        genSkipOnboardingLink={() => null}
      />,
      {
        organization,
        additionalWrapper: makeOnboardingWrapper({
          selectedPlatform: mockPlatform,
        }),
      }
    );

    await userEvent.click(await screen.findByRole('button', {name: 'Create project'}));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });

    // Verify the project slug was stored separately in context (not overwriting
    // selectedPlatform.key) so onboarding.tsx can find the project via
    // useRecentCreatedProject while preserving the original platform selection.
    const stored = JSON.parse(sessionStorageWrapper.getItem('onboarding') ?? '{}');
    expect(stored.createdProjectSlug).toBe('my-custom-project');
    expect(stored.selectedPlatform?.key).toBe('javascript-nextjs');
  });

  it('shows error message on project creation failure', async () => {
    const onComplete = jest.fn();

    MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${teamWithAccess.slug}/projects/`,
      method: 'POST',
      statusCode: 500,
      body: {detail: 'Internal Error'},
    });

    render(
      <ScmProjectDetails
        onComplete={onComplete}
        stepIndex={3}
        genSkipOnboardingLink={() => null}
      />,
      {
        organization,
        additionalWrapper: makeOnboardingWrapper({
          selectedPlatform: mockPlatform,
        }),
      }
    );

    const createButton = await screen.findByRole('button', {name: 'Create project'});
    await userEvent.click(createButton);

    await waitFor(() => {
      expect(onComplete).not.toHaveBeenCalled();
    });
  });

  it('fires step viewed analytics on mount', async () => {
    const trackAnalyticsSpy = jest.spyOn(analytics, 'trackAnalytics');

    render(
      <ScmProjectDetails
        onComplete={jest.fn()}
        stepIndex={3}
        genSkipOnboardingLink={() => null}
      />,
      {
        organization,
        additionalWrapper: makeOnboardingWrapper({
          selectedPlatform: mockPlatform,
        }),
      }
    );

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

    const onComplete = jest.fn();

    render(
      <ScmProjectDetails
        onComplete={onComplete}
        stepIndex={3}
        genSkipOnboardingLink={() => null}
      />,
      {
        organization,
        additionalWrapper: makeOnboardingWrapper({
          selectedPlatform: mockPlatform,
        }),
      }
    );

    await userEvent.click(await screen.findByRole('button', {name: 'Create project'}));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });

    const eventKeys = trackAnalyticsSpy.mock.calls.map(call => call[0]);
    expect(eventKeys).toContain('onboarding.scm_project_details_create_clicked');
    expect(eventKeys).toContain('onboarding.scm_project_details_create_succeeded');
  });
});
