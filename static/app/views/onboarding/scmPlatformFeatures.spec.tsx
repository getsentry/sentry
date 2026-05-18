import {DetectedPlatformFixture} from 'sentry-fixture/detectedPlatform';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RepositoryFixture} from 'sentry-fixture/repository';
import {TeamFixture} from 'sentry-fixture/team';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {openConsoleModal, openModal} from 'sentry/actionCreators/modal';
import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  OnboardingContextProvider,
  type OnboardingSessionState,
} from 'sentry/components/onboarding/onboardingContext';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {TeamStore} from 'sentry/stores/teamStore';
import * as analytics from 'sentry/utils/analytics';
import {sessionStorageWrapper} from 'sentry/utils/sessionStorage';

import {ScmPlatformFeatures} from './scmPlatformFeatures';

jest.mock('sentry/actionCreators/modal');

// Mock the virtualizer so all items render in JSDOM (no layout engine).
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

// Provide a small platform list so the Select dropdown renders
// a manageable number of options in JSDOM.
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

const mockRepository = RepositoryFixture({
  id: '42',
  provider: {id: 'integrations:github', name: 'GitHub'},
});

describe('ScmPlatformFeatures', () => {
  const organization = OrganizationFixture({
    features: ['performance-view', 'session-replay', 'profiling-view'],
  });

  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorageWrapper.clear();
    ProjectsStore.loadInitialData([]);
    TeamStore.loadInitialData([]);
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

    const radioGroup = await screen.findByRole('radiogroup');
    expect(within(radioGroup).getByText('Next.js')).toBeInTheDocument();
    expect(within(radioGroup).getByText('Django')).toBeInTheDocument();
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

    expect(
      await screen.findByRole('heading', {level: 3, name: 'Available with Next.js'})
    ).toBeInTheDocument();
  });

  describe('feature card variants', () => {
    it('renders informational cards for wizard-driven platforms (no toggles)', async () => {
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

      expect(
        await screen.findByRole('heading', {level: 3, name: 'Available with Next.js'})
      ).toBeInTheDocument();
      expect(screen.getByText('Error monitoring')).toBeInTheDocument();
      expect(screen.getByText('Tracing')).toBeInTheDocument();
      expect(screen.getByText('Session replay')).toBeInTheDocument();
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
      expect(
        screen.queryByText('What do you want to instrument?')
      ).not.toBeInTheDocument();
    });

    it('renders toggleable cards for curated platforms', async () => {
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
          }),
        }
      );

      expect(
        await screen.findByText('What do you want to instrument?')
      ).toBeInTheDocument();
      expect(screen.getByRole('checkbox', {name: /Tracing/})).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', {level: 3, name: /^Available with /})
      ).not.toBeInTheDocument();
    });

    it('skips the feature-cards block for platforms in neither map', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/repos/42/platforms/`,
        body: {platforms: []},
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
              key: 'nintendo-switch',
              name: 'Nintendo Switch',
              language: 'nintendo-switch',
              type: 'console',
              link: null,
              category: 'all',
            },
          }),
        }
      );

      await screen.findByRole('button', {name: 'Continue'});

      expect(
        screen.queryByRole('heading', {level: 3, name: /^Available with /})
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('What do you want to instrument?')
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/unlimited volume for 14 days/)).not.toBeInTheDocument();
    });
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

    expect(screen.getByText('Select a platform')).toBeInTheDocument();
  });

  it('falls back to manual picker when platform detection fails', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/42/platforms/`,
      statusCode: 500,
      body: {detail: 'Internal Error'},
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

    expect(await screen.findByText('Select a platform')).toBeInTheDocument();
    expect(
      screen.queryByText('Auto-detected from your repository')
    ).not.toBeInTheDocument();
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

    expect(await screen.findByText('Select a platform')).toBeInTheDocument();
    expect(
      screen.queryByText('Auto-detected from your repository')
    ).not.toBeInTheDocument();
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
    await screen.findByText('Select a platform');

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
    await screen.findByText('What do you want to instrument?');

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

    await screen.findByText('Select a platform');

    // Type into the Select to search and pick a base language
    await userEvent.type(screen.getByRole('textbox'), 'JavaScript');
    await userEvent.click(await screen.findByText('Browser JavaScript'));

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

    await screen.findByText('Select a platform');

    // Type into the Select to search and pick a console platform
    await userEvent.type(screen.getByRole('textbox'), 'Nintendo');
    await userEvent.click(await screen.findByText('Nintendo Switch'));

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
    await screen.findByText('What do you want to instrument?');

    // Both should be checked initially
    expect(screen.getByRole('checkbox', {name: /Tracing/})).toBeChecked();
    expect(screen.getByRole('checkbox', {name: /Profiling/})).toBeChecked();

    // Disable tracing — profiling should auto-disable
    await userEvent.click(screen.getByRole('checkbox', {name: /Tracing/}));

    expect(screen.getByRole('checkbox', {name: /Tracing/})).not.toBeChecked();
    expect(screen.getByRole('checkbox', {name: /Profiling/})).not.toBeChecked();
  });

  it('clears persisted project details form when detected platform changes', async () => {
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
          projectDetailsForm: {
            projectName: 'stale-name',
            teamSlug: 'stale-team',
          },
        }),
      }
    );

    const djangoCard = await screen.findByRole('radio', {name: /Django/});
    await userEvent.click(djangoCard);

    await waitFor(() => {
      const stored = JSON.parse(sessionStorageWrapper.getItem('onboarding') ?? '{}');
      expect(stored.projectDetailsForm).toBeUndefined();
    });
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

      await screen.findByText('Select a platform');

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

    it('fires platform selected event once when auto-detection resolves', async () => {
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

      await screen.findByRole('heading', {level: 3, name: 'Available with Next.js'});

      const detectedCalls = trackAnalyticsSpy.mock.calls.filter(
        ([event, params]) =>
          event === 'onboarding.scm_platform_selected' &&
          params.platform === 'javascript-nextjs' &&
          params.source === 'detected'
      );
      expect(detectedCalls).toHaveLength(1);
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

      await screen.findByText('What do you want to instrument?');

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

  describe('project-details step skipped (control group)', () => {
    const adminTeam = TeamFixture({slug: 'admin-team', access: ['team:admin']});
    const nextJsPlatform = {
      key: 'javascript-nextjs' as const,
      name: 'Next.js',
      language: 'javascript' as const,
      link: 'https://docs.sentry.io/platforms/javascript/guides/nextjs/',
      type: 'framework' as const,
      category: 'browser' as const,
    };

    beforeEach(() => {
      TeamStore.loadInitialData([adminTeam]);
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
    });

    it('auto-creates the project on Continue and forwards selected features', async () => {
      const onComplete = jest.fn();
      const createdProject = ProjectFixture({
        slug: 'javascript-nextjs',
        platform: 'javascript-nextjs',
      });
      const createRequest = MockApiClient.addMockResponse({
        url: `/teams/${organization.slug}/${adminTeam.slug}/projects/`,
        method: 'POST',
        body: createdProject,
      });

      render(
        <ScmPlatformFeatures
          onComplete={onComplete}
          stepIndex={2}
          genSkipOnboardingLink={() => null}
        />,
        {
          organization,
          additionalWrapper: makeOnboardingWrapper({
            selectedPlatform: nextJsPlatform,
            selectedFeatures: [ProductSolution.ERROR_MONITORING],
          }),
        }
      );

      await waitFor(() => {
        expect(screen.getByRole('button', {name: 'Continue'})).toBeEnabled();
      });
      await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

      await waitFor(() => {
        expect(createRequest).toHaveBeenCalledWith(
          `/teams/${organization.slug}/${adminTeam.slug}/projects/`,
          expect.objectContaining({
            method: 'POST',
            data: expect.objectContaining({
              platform: 'javascript-nextjs',
              name: 'javascript-nextjs',
              default_rules: true,
            }),
          })
        );
      });
      expect(onComplete).toHaveBeenCalledWith(nextJsPlatform, {
        product: [ProductSolution.ERROR_MONITORING],
      });
    });

    it('reuses the existing project when the platform is unchanged', async () => {
      const onComplete = jest.fn();
      const existingProject = ProjectFixture({
        slug: 'javascript-nextjs',
        platform: 'javascript-nextjs',
      });
      ProjectsStore.loadInitialData([existingProject]);
      const createRequest = MockApiClient.addMockResponse({
        url: `/teams/${organization.slug}/${adminTeam.slug}/projects/`,
        method: 'POST',
        body: existingProject,
      });

      render(
        <ScmPlatformFeatures
          onComplete={onComplete}
          stepIndex={2}
          genSkipOnboardingLink={() => null}
        />,
        {
          organization,
          additionalWrapper: makeOnboardingWrapper({
            selectedPlatform: nextJsPlatform,
            selectedFeatures: [ProductSolution.ERROR_MONITORING],
            createdProjectSlug: existingProject.slug,
          }),
        }
      );

      await waitFor(() => {
        expect(screen.getByRole('button', {name: 'Continue'})).toBeEnabled();
      });
      await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledWith(nextJsPlatform, {
          product: [ProductSolution.ERROR_MONITORING],
        });
      });
      expect(createRequest).not.toHaveBeenCalled();
    });

    it('creates a new project when the platform changed from the existing one', async () => {
      const onComplete = jest.fn();
      const stalePythonProject = ProjectFixture({
        slug: 'python',
        platform: 'python',
      });
      ProjectsStore.loadInitialData([stalePythonProject]);
      const newProject = ProjectFixture({
        slug: 'javascript-nextjs',
        platform: 'javascript-nextjs',
      });
      const createRequest = MockApiClient.addMockResponse({
        url: `/teams/${organization.slug}/${adminTeam.slug}/projects/`,
        method: 'POST',
        body: newProject,
      });

      render(
        <ScmPlatformFeatures
          onComplete={onComplete}
          stepIndex={2}
          genSkipOnboardingLink={() => null}
        />,
        {
          organization,
          additionalWrapper: makeOnboardingWrapper({
            selectedPlatform: nextJsPlatform,
            selectedFeatures: [ProductSolution.ERROR_MONITORING],
            createdProjectSlug: stalePythonProject.slug,
          }),
        }
      );

      await waitFor(() => {
        expect(screen.getByRole('button', {name: 'Continue'})).toBeEnabled();
      });
      await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

      await waitFor(() => {
        expect(createRequest).toHaveBeenCalled();
      });
      expect(onComplete).toHaveBeenCalledWith(nextJsPlatform, {
        product: [ProductSolution.ERROR_MONITORING],
      });
    });

    it('forwards the detected platform to onComplete when the user did not click a card', async () => {
      // Regression: if the user hits Continue without explicitly selecting a
      // detected platform, selectedPlatform stays undefined in context while
      // currentPlatformKey falls back to the detected key. Passing undefined
      // to onComplete here would trip goNextStep's SETUP_DOCS guard because
      // the captured closure still sees selectedPlatform as undefined.
      const onComplete = jest.fn();
      const createdProject = ProjectFixture({
        slug: 'javascript-nextjs',
        platform: 'javascript-nextjs',
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/repos/42/platforms/`,
        body: {
          platforms: [
            DetectedPlatformFixture({
              platform: 'javascript-nextjs',
              language: 'javascript',
            }),
          ],
        },
      });
      MockApiClient.addMockResponse({
        url: `/teams/${organization.slug}/${adminTeam.slug}/projects/`,
        method: 'POST',
        body: createdProject,
      });

      render(
        <ScmPlatformFeatures
          onComplete={onComplete}
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

      await screen.findByRole('radio', {name: /Next.js/});
      await waitFor(() => {
        expect(screen.getByRole('button', {name: 'Continue'})).toBeEnabled();
      });
      await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledWith(
          expect.objectContaining({key: 'javascript-nextjs'}),
          {product: [ProductSolution.ERROR_MONITORING]}
        );
      });
    });
  });

  describe('project-details step enabled (experiment group)', () => {
    const experimentOrganization = OrganizationFixture({
      features: [
        'performance-view',
        'session-replay',
        'profiling-view',
        'onboarding-scm-project-details-experiment',
      ],
    });
    const nextJsPlatform = {
      key: 'javascript-nextjs' as const,
      name: 'Next.js',
      language: 'javascript' as const,
      link: 'https://docs.sentry.io/platforms/javascript/guides/nextjs/',
      type: 'framework' as const,
      category: 'browser' as const,
    };

    it('advances without creating a project on Continue', async () => {
      const onComplete = jest.fn();
      const createRequest = MockApiClient.addMockResponse({
        url: `/teams/${experimentOrganization.slug}/team-slug/projects/`,
        method: 'POST',
        body: ProjectFixture(),
      });

      render(
        <ScmPlatformFeatures
          onComplete={onComplete}
          stepIndex={2}
          genSkipOnboardingLink={() => null}
        />,
        {
          organization: experimentOrganization,
          additionalWrapper: makeOnboardingWrapper({
            selectedPlatform: nextJsPlatform,
            selectedFeatures: [ProductSolution.ERROR_MONITORING],
          }),
        }
      );

      await waitFor(() => {
        expect(screen.getByRole('button', {name: 'Continue'})).toBeEnabled();
      });
      await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledWith();
      });
      expect(createRequest).not.toHaveBeenCalled();
    });
  });
});
