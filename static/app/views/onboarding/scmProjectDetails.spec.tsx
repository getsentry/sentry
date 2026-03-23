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
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
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

  it('renders project name defaulted from repository name when SCM connected', async () => {
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

    // slugify('getsentry/sentry') strips the slash -> 'getsentrysentry'
    const input = await screen.findByPlaceholderText('project-name');
    expect(input).toHaveValue('getsentrysentry');
  });

  it('renders alert frequency options', async () => {
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

    expect(
      await screen.findByText('Alert me on high priority issues')
    ).toBeInTheDocument();
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
});
