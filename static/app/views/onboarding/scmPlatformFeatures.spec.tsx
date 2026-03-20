import {DetectedPlatformFixture} from 'sentry-fixture/detectedPlatform';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  OnboardingContextProvider,
  type OnboardingSessionState,
} from 'sentry/components/onboarding/onboardingContext';
import {RepositoryStatus, type Repository} from 'sentry/types/integrations';
import {sessionStorageWrapper} from 'sentry/utils/sessionStorage';

import {ScmPlatformFeatures} from './scmPlatformFeatures';

function makeOnboardingWrapper(initialState?: OnboardingSessionState) {
  return function OnboardingWrapper({children}: {children?: React.ReactNode}) {
    return (
      <OnboardingContextProvider initialValue={initialState}>
        {children}
      </OnboardingContextProvider>
    );
  };
}

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

describe('ScmPlatformFeatures', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    sessionStorageWrapper.clear();
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders detected platforms when repository is in context', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/42/platforms/`,
      body: {
        platforms: [
          DetectedPlatformFixture(),
          DetectedPlatformFixture({
            platform: 'python-django',
            language: 'Python',
            priority: 2,
          }),
        ],
      },
    });

    render(
      <ScmPlatformFeatures
        onComplete={jest.fn()}
        stepIndex={2}
        genSkipOnboardingLink={() => null}
      />,
      {
        organization,
        additionalWrapper: makeOnboardingWrapper({
          selectedRepository: mockRepository,
        }),
      }
    );

    expect(await screen.findByText('Next.js')).toBeInTheDocument();
    expect(screen.getByText('Django')).toBeInTheDocument();
  });

  it('auto-selects first detected platform', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/42/platforms/`,
      body: {
        platforms: [
          DetectedPlatformFixture(),
          DetectedPlatformFixture({
            platform: 'python-django',
            language: 'Python',
            priority: 2,
          }),
        ],
      },
    });

    render(
      <ScmPlatformFeatures
        onComplete={jest.fn()}
        stepIndex={2}
        genSkipOnboardingLink={() => null}
      />,
      {
        organization,
        additionalWrapper: makeOnboardingWrapper({
          selectedRepository: mockRepository,
        }),
      }
    );

    expect(await screen.findByText('What do you want to set up?')).toBeInTheDocument();
  });

  it('clicking "Change platform" shows manual picker', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/42/platforms/`,
      body: {
        platforms: [
          DetectedPlatformFixture(),
          DetectedPlatformFixture({
            platform: 'python-django',
            language: 'Python',
            priority: 2,
          }),
        ],
      },
    });

    render(
      <ScmPlatformFeatures
        onComplete={jest.fn()}
        stepIndex={2}
        genSkipOnboardingLink={() => null}
      />,
      {
        organization,
        additionalWrapper: makeOnboardingWrapper({
          selectedRepository: mockRepository,
        }),
      }
    );

    const changeButton = await screen.findByRole('button', {
      name: "Doesn't look right? Change platform",
    });
    await userEvent.click(changeButton);

    expect(screen.getByRole('heading', {name: 'Select a platform'})).toBeInTheDocument();
  });

  it('renders manual picker when no repository in context', async () => {
    render(
      <ScmPlatformFeatures
        onComplete={jest.fn()}
        stepIndex={2}
        genSkipOnboardingLink={() => null}
      />,
      {
        organization,
        additionalWrapper: makeOnboardingWrapper(),
      }
    );

    expect(
      await screen.findByRole('heading', {name: 'Select a platform'})
    ).toBeInTheDocument();
    expect(screen.queryByText('Recommended SDK')).not.toBeInTheDocument();
  });

  it('continue button is disabled when no platform selected', async () => {
    render(
      <ScmPlatformFeatures
        onComplete={jest.fn()}
        stepIndex={2}
        genSkipOnboardingLink={() => null}
      />,
      {
        organization,
        additionalWrapper: makeOnboardingWrapper(),
      }
    );

    // Wait for the component to fully settle (CompactSelect triggers async popper updates)
    await screen.findByRole('heading', {name: 'Select a platform'});

    expect(screen.getByRole('button', {name: 'Continue'})).toBeDisabled();
  });

  it('continue button is enabled when platform is selected', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/42/platforms/`,
      body: {
        platforms: [DetectedPlatformFixture()],
      },
    });

    render(
      <ScmPlatformFeatures
        onComplete={jest.fn()}
        stepIndex={2}
        genSkipOnboardingLink={() => null}
      />,
      {
        organization,
        additionalWrapper: makeOnboardingWrapper({
          selectedRepository: mockRepository,
        }),
      }
    );

    // Wait for auto-select of first detected platform
    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Continue'})).toBeEnabled();
    });
  });
});
