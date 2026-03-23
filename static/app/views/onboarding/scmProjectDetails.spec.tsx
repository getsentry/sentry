import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  OnboardingContextProvider,
  type OnboardingSessionState,
} from 'sentry/components/onboarding/onboardingContext';
import {TeamStore} from 'sentry/stores/teamStore';
import {RepositoryStatus, type Repository} from 'sentry/types/integrations';
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

const mockRepository: Repository = {
  id: '42',
  name: 'getsentry/sentry',
  externalId: '123',
  externalSlug: 'getsentry/sentry',
  url: 'https://github.com/getsentry/sentry',
  integrationId: '1',
  status: RepositoryStatus.ACTIVE,
  dateCreated: '2024-01-01T00:00:00.000Z',
  provider: {id: 'integrations:github', name: 'GitHub'},
};

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
