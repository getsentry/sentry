import {DetectedPlatformFixture} from 'sentry-fixture/detectedPlatform';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RepositoryFixture} from 'sentry-fixture/repository';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {openConsoleModal, openModal} from 'sentry/actionCreators/modal';
import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  OnboardingContextProvider,
  type OnboardingSessionState,
} from 'sentry/components/onboarding/onboardingContext';
import * as analytics from 'sentry/utils/analytics';
import {sessionStorageWrapper} from 'sentry/utils/sessionStorage';

import {ScmPlatformFeatures} from './scmPlatformFeatures';

jest.mock('sentry/actionCreators/modal');

// Provide a small platform list so CompactSelect stays below the
// virtualizeThreshold (50) and renders all options in JSDOM.
jest.mock('sentry/data/platforms', () => {
  const actual = jest.requireActual('sentry/data/platforms');
  return {
    ...actual,
    platforms: actual.platforms.filter(
      (p: {id: string}) =>
        p.id === 'javascript' ||
        p.id === 'javascript-nextjs' ||
        p.id === 'python' ||
        p.id === 'python-django' ||
        p.id === 'nintendo-switch'
    ),
  };
});

function makeOnboardingWrapper(initialState?: OnboardingSessionState) {
  return function OnboardingWrapper({children}: {children?: React.ReactNode}) {
    return (
      <OnboardingContextProvider initialValue={initialState}>
        {children}
      </OnboardingContextProvider>
    );
  };
}

const mockRepository = RepositoryFixture({id: '42'});

describe('ScmPlatformFeatures', () => {
  const organization = OrganizationFixture({
    features: ['performance-view', 'session-replay', 'profiling-view'],
  });

  beforeEach(() => {
    jest.clearAllMocks();
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

  it('enabling profiling auto-enables tracing', async () => {
    const pythonPlatform = DetectedPlatformFixture({
      platform: 'python',
      language: 'Python',
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/42/platforms/`,
      body: {platforms: [pythonPlatform]},
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
          selectedFeatures: [ProductSolution.ERROR_MONITORING],
        }),
      }
    );

    // Wait for feature cards to appear
    await screen.findByText('What do you want to set up?');

    // Neither profiling nor tracing should be checked initially
    expect(screen.getByRole('checkbox', {name: /Profiling/})).not.toBeChecked();
    expect(screen.getByRole('checkbox', {name: /Tracing/})).not.toBeChecked();

    // Enable profiling — tracing should auto-enable
    await userEvent.click(screen.getByRole('checkbox', {name: /Profiling/}));

    expect(screen.getByRole('checkbox', {name: /Profiling/})).toBeChecked();
    expect(screen.getByRole('checkbox', {name: /Tracing/})).toBeChecked();
  });

  it('shows framework suggestion modal when selecting a base language', async () => {
    const mockOpenModal = openModal as jest.Mock;

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

    await screen.findByRole('heading', {name: 'Select a platform'});

    // Open the CompactSelect and select a base language
    await userEvent.click(screen.getByRole('button', {name: 'None'}));
    await userEvent.click(
      await screen.findByRole('option', {name: 'Browser JavaScript'})
    );

    await waitFor(() => {
      expect(mockOpenModal).toHaveBeenCalled();
    });
  });

  it('opens console modal when selecting a disabled gaming platform', async () => {
    const mockOpenConsoleModal = openConsoleModal as jest.Mock;

    render(
      <ScmPlatformFeatures
        onComplete={jest.fn()}
        stepIndex={2}
        genSkipOnboardingLink={() => null}
      />,
      {
        // No enabledConsolePlatforms — all console platforms are blocked
        organization: OrganizationFixture({
          features: ['performance-view', 'session-replay', 'profiling-view'],
        }),
        additionalWrapper: makeOnboardingWrapper(),
      }
    );

    await screen.findByRole('heading', {name: 'Select a platform'});

    // Open the CompactSelect and select a console platform
    await userEvent.click(screen.getByRole('button', {name: 'None'}));
    await userEvent.click(await screen.findByRole('option', {name: 'Nintendo Switch'}));

    await waitFor(() => {
      expect(mockOpenConsoleModal).toHaveBeenCalled();
    });
  });

  it('disabling tracing auto-disables profiling', async () => {
    const pythonPlatform = DetectedPlatformFixture({
      platform: 'python',
      language: 'Python',
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/42/platforms/`,
      body: {platforms: [pythonPlatform]},
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
          selectedPlatform: {
            key: 'python',
            name: 'Python',
            language: 'python',
            type: 'language',
            link: 'https://docs.sentry.io/platforms/python/',
            category: 'popular',
          },
          selectedFeatures: [
            ProductSolution.ERROR_MONITORING,
            ProductSolution.PERFORMANCE_MONITORING,
            ProductSolution.PROFILING,
          ],
        }),
      }
    );

    // Wait for feature cards to appear
    await screen.findByText('What do you want to set up?');

    // Both should be checked initially
    expect(screen.getByRole('checkbox', {name: /Tracing/})).toBeChecked();
    expect(screen.getByRole('checkbox', {name: /Profiling/})).toBeChecked();

    // Disable tracing — profiling should auto-disable
    await userEvent.click(screen.getByRole('checkbox', {name: /Tracing/}));

    expect(screen.getByRole('checkbox', {name: /Tracing/})).not.toBeChecked();
    expect(screen.getByRole('checkbox', {name: /Profiling/})).not.toBeChecked();
  });

  describe('analytics', () => {
    let trackAnalyticsSpy: jest.SpyInstance;

    beforeEach(() => {
      trackAnalyticsSpy = jest.spyOn(analytics, 'trackAnalytics');
    });

    it('fires step viewed event on mount', async () => {
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

      await screen.findByRole('heading', {name: 'Select a platform'});

      expect(trackAnalyticsSpy).toHaveBeenCalledWith(
        'onboarding.scm_platform_features_step_viewed',
        expect.objectContaining({organization})
      );
    });

    it('fires platform selected event when clicking a detected platform', async () => {
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

      // Wait for detected platforms, then click the second one
      const djangoCard = await screen.findByRole('radio', {name: /Django/});
      await userEvent.click(djangoCard);

      expect(trackAnalyticsSpy).toHaveBeenCalledWith(
        'onboarding.scm_platform_selected',
        expect.objectContaining({
          platform: 'python-django',
          source: 'detected',
        })
      );
    });

    it('fires feature toggled event when toggling a feature', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/repos/42/platforms/`,
        body: {
          platforms: [DetectedPlatformFixture({platform: 'python', language: 'Python'})],
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
            selectedFeatures: [ProductSolution.ERROR_MONITORING],
          }),
        }
      );

      await screen.findByText('What do you want to set up?');

      await userEvent.click(screen.getByRole('checkbox', {name: /Tracing/}));

      expect(trackAnalyticsSpy).toHaveBeenCalledWith(
        'onboarding.scm_platform_feature_toggled',
        expect.objectContaining({
          feature: ProductSolution.PERFORMANCE_MONITORING,
          enabled: true,
          platform: 'python',
        })
      );
    });

    it('fires change platform event when clicking the link', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/repos/42/platforms/`,
        body: {platforms: [DetectedPlatformFixture()]},
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

      expect(trackAnalyticsSpy).toHaveBeenCalledWith(
        'onboarding.scm_platform_change_platform_clicked',
        expect.objectContaining({organization})
      );
    });
  });
});
