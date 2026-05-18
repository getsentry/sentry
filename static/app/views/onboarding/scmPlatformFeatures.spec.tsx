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
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {TeamStore} from 'sentry/stores/teamStore';
import type {Repository} from 'sentry/types/integrations';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import * as analytics from 'sentry/utils/analytics';

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

interface StateOverrides {
  createdProjectSlug?: string;
  selectedFeatures?: ProductSolution[];
  selectedPlatform?: OnboardingSelectedSDK;
  selectedRepository?: Repository;
}

function defaultProps(state: StateOverrides = {}) {
  return {
    selectedRepository: state.selectedRepository,
    selectedPlatform: state.selectedPlatform,
    selectedFeatures: state.selectedFeatures,
    createdProjectSlug: state.createdProjectSlug,
    onPlatformChange: jest.fn(),
    onFeaturesChange: jest.fn(),
    onClearProjectDetailsForm: jest.fn(),
    onProjectCreated: jest.fn(),
    onComplete: jest.fn(),
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
      <ScmPlatformFeatures {...defaultProps({selectedRepository: mockRepository})} />,
      {organization}
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
      <ScmPlatformFeatures {...defaultProps({selectedRepository: mockRepository})} />,
      {organization}
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
        <ScmPlatformFeatures {...defaultProps({selectedRepository: mockRepository})} />,
        {organization}
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
        <ScmPlatformFeatures {...defaultProps({selectedRepository: mockRepository})} />,
        {organization}
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
          {...defaultProps({
            selectedRepository: mockRepository,
            selectedPlatform: {
              key: 'nintendo-switch',
              name: 'Nintendo Switch',
              language: 'nintendo-switch',
              type: 'console',
              link: null,
              category: 'all',
            },
          })}
        />,
        {organization}
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
      <ScmPlatformFeatures {...defaultProps({selectedRepository: mockRepository})} />,
      {organization}
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
      <ScmPlatformFeatures {...defaultProps({selectedRepository: mockRepository})} />,
      {organization}
    );

    expect(await screen.findByText('Select a platform')).toBeInTheDocument();
    expect(
      screen.queryByText('Auto-detected from your repository')
    ).not.toBeInTheDocument();
  });

  it('renders manual picker when no repository in context', async () => {
    render(<ScmPlatformFeatures {...defaultProps()} />, {organization});

    expect(await screen.findByText('Select a platform')).toBeInTheDocument();
    expect(
      screen.queryByText('Auto-detected from your repository')
    ).not.toBeInTheDocument();
  });

  it('continue button is disabled when no platform selected', async () => {
    render(<ScmPlatformFeatures {...defaultProps()} />, {organization});

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
      <ScmPlatformFeatures {...defaultProps({selectedRepository: mockRepository})} />,
      {organization}
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

    const props = defaultProps({
      selectedRepository: mockRepository,
      selectedFeatures: [ProductSolution.ERROR_MONITORING],
    });
    render(<ScmPlatformFeatures {...props} />, {organization});

    // Wait for feature cards to appear
    await screen.findByText('What do you want to instrument?');

    // Enable profiling — onFeaturesChange should be called with tracing also enabled
    await userEvent.click(screen.getByRole('checkbox', {name: /Profiling/}));

    expect(props.onFeaturesChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PROFILING,
        ProductSolution.PERFORMANCE_MONITORING,
      ])
    );
  });

  it('shows framework suggestion modal when selecting a base language', async () => {
    const mockOpenModal = openModal as jest.Mock;

    render(<ScmPlatformFeatures {...defaultProps()} />, {organization});

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

    render(<ScmPlatformFeatures {...defaultProps()} />, {
      // No enabledConsolePlatforms — all console platforms are blocked
      organization: OrganizationFixture({
        features: ['performance-view', 'session-replay', 'profiling-view'],
      }),
    });

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

    const props = defaultProps({
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
    });
    render(<ScmPlatformFeatures {...props} />, {organization});

    // Wait for feature cards to appear
    await screen.findByText('What do you want to instrument?');

    // Disable tracing — onFeaturesChange should drop both tracing and profiling
    await userEvent.click(screen.getByRole('checkbox', {name: /Tracing/}));

    expect(props.onFeaturesChange).toHaveBeenCalledWith(
      expect.not.arrayContaining([
        ProductSolution.PERFORMANCE_MONITORING,
        ProductSolution.PROFILING,
      ])
    );
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

    // The component is stateless w.r.t. the form, so we just verify it calls
    // the clear callback when the user changes the detected platform.
    const props = defaultProps({selectedRepository: mockRepository});
    render(<ScmPlatformFeatures {...props} />, {organization});

    const djangoCard = await screen.findByRole('radio', {name: /Django/});
    await userEvent.click(djangoCard);

    expect(props.onClearProjectDetailsForm).toHaveBeenCalled();
  });

  describe('analytics', () => {
    let trackAnalyticsSpy: jest.SpyInstance;

    beforeEach(() => {
      trackAnalyticsSpy = jest.spyOn(analytics, 'trackAnalytics');
    });

    it('fires step viewed event on mount', async () => {
      render(<ScmPlatformFeatures {...defaultProps()} />, {organization});

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
        <ScmPlatformFeatures {...defaultProps({selectedRepository: mockRepository})} />,
        {organization}
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
        <ScmPlatformFeatures {...defaultProps({selectedRepository: mockRepository})} />,
        {organization}
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
          {...defaultProps({
            selectedRepository: mockRepository,
            selectedFeatures: [ProductSolution.ERROR_MONITORING],
          })}
        />,
        {organization}
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
        <ScmPlatformFeatures {...defaultProps({selectedRepository: mockRepository})} />,
        {organization}
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
      const createdProject = ProjectFixture({
        slug: 'javascript-nextjs',
        platform: 'javascript-nextjs',
      });
      const createRequest = MockApiClient.addMockResponse({
        url: `/teams/${organization.slug}/${adminTeam.slug}/projects/`,
        method: 'POST',
        body: createdProject,
      });

      const props = defaultProps({
        selectedPlatform: nextJsPlatform,
        selectedFeatures: [ProductSolution.ERROR_MONITORING],
      });
      render(<ScmPlatformFeatures {...props} />, {organization});

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
      expect(props.onComplete).toHaveBeenCalledWith(nextJsPlatform, {
        product: [ProductSolution.ERROR_MONITORING],
      });
      expect(props.onProjectCreated).toHaveBeenCalledWith(createdProject.slug);
    });

    it('reuses the existing project when the platform is unchanged', async () => {
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

      const props = defaultProps({
        selectedPlatform: nextJsPlatform,
        selectedFeatures: [ProductSolution.ERROR_MONITORING],
        createdProjectSlug: existingProject.slug,
      });
      render(<ScmPlatformFeatures {...props} />, {organization});

      await waitFor(() => {
        expect(screen.getByRole('button', {name: 'Continue'})).toBeEnabled();
      });
      await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

      await waitFor(() => {
        expect(props.onComplete).toHaveBeenCalledWith(nextJsPlatform, {
          product: [ProductSolution.ERROR_MONITORING],
        });
      });
      expect(createRequest).not.toHaveBeenCalled();
    });

    it('creates a new project when the platform changed from the existing one', async () => {
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

      const props = defaultProps({
        selectedPlatform: nextJsPlatform,
        selectedFeatures: [ProductSolution.ERROR_MONITORING],
        createdProjectSlug: stalePythonProject.slug,
      });
      render(<ScmPlatformFeatures {...props} />, {organization});

      await waitFor(() => {
        expect(screen.getByRole('button', {name: 'Continue'})).toBeEnabled();
      });
      await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

      await waitFor(() => {
        expect(createRequest).toHaveBeenCalled();
      });
      expect(props.onComplete).toHaveBeenCalledWith(nextJsPlatform, {
        product: [ProductSolution.ERROR_MONITORING],
      });
    });

    it('forwards the detected platform to onComplete when the user did not click a card', async () => {
      // Regression: if the user hits Continue without explicitly selecting a
      // detected platform, selectedPlatform stays undefined in context while
      // currentPlatformKey falls back to the detected key. Passing undefined
      // to onComplete here would trip goNextStep's SETUP_DOCS guard because
      // the captured closure still sees selectedPlatform as undefined.
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

      const props = defaultProps({selectedRepository: mockRepository});
      render(<ScmPlatformFeatures {...props} />, {organization});

      await screen.findByRole('radio', {name: /Next.js/});
      await waitFor(() => {
        expect(screen.getByRole('button', {name: 'Continue'})).toBeEnabled();
      });
      await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

      await waitFor(() => {
        expect(props.onComplete).toHaveBeenCalledWith(
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
      const createRequest = MockApiClient.addMockResponse({
        url: `/teams/${experimentOrganization.slug}/team-slug/projects/`,
        method: 'POST',
        body: ProjectFixture(),
      });

      const props = defaultProps({
        selectedPlatform: nextJsPlatform,
        selectedFeatures: [ProductSolution.ERROR_MONITORING],
      });
      render(<ScmPlatformFeatures {...props} />, {
        organization: experimentOrganization,
      });

      await waitFor(() => {
        expect(screen.getByRole('button', {name: 'Continue'})).toBeEnabled();
      });
      await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

      await waitFor(() => {
        expect(props.onComplete).toHaveBeenCalledWith();
      });
      expect(createRequest).not.toHaveBeenCalled();
    });
  });
});
