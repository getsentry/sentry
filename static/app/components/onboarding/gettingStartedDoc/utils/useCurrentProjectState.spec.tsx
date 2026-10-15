import {ProjectFixture} from 'sentry-fixture/project';

import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {useCurrentProjectState} from 'sentry/components/onboarding/gettingStartedDoc/utils/useCurrentProjectState';
import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {
  feedbackOnboardingPlatforms,
  replayOnboardingPlatforms,
  replayPlatforms,
} from 'sentry/data/platformCategories';
import {OnboardingDrawerKey} from 'sentry/stores/onboardingDrawerStore';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Project} from 'sentry/types/project';

function mockPageFilterStore(projects: Project[]) {
  PageFiltersStore.init();
  PageFiltersStore.onInitializeUrlState({
    projects: projects.map(p => parseInt(p.id, 10)),
    environments: [],
    datetime: {
      period: '7d',
      start: null,
      end: null,
      utc: null,
    },
  });
}

describe('useCurrentProjectState', () => {
  const rust_1 = ProjectFixture({id: '1', platform: 'rust', slug: 'project-a'});
  const rust_2 = ProjectFixture({id: '2', platform: 'rust', slug: 'project-b'});
  const javascript = ProjectFixture({
    id: '3',
    platform: 'javascript',
    slug: 'project-c',
  });
  const angular = ProjectFixture({
    id: '4',
    platform: 'javascript-angular',
    slug: 'project-d',
  });

  it('should return currentProject=undefined when currentPanel != targetPanel', () => {
    ProjectsStore.loadInitialData([javascript]);
    mockPageFilterStore([javascript]);
    const {result} = renderHookWithProviders(useCurrentProjectState, {
      initialProps: {
        currentPanel: OnboardingDrawerKey.REPLAYS_ONBOARDING,
        targetPanel: OnboardingDrawerKey.FEEDBACK_ONBOARDING,
        onboardingPlatforms: feedbackOnboardingPlatforms,
        allPlatforms: feedbackOnboardingPlatforms,
      },
    });
    expect(result.current.currentProject).toBeUndefined();
  });

  it('should return currentProject=undefined when project query parameter is present and currentPanel != targetPanel', () => {
    ProjectsStore.loadInitialData([javascript, angular]);
    mockPageFilterStore([javascript, angular]);
    const {result} = renderHookWithProviders(useCurrentProjectState, {
      initialProps: {
        currentPanel: OnboardingDrawerKey.REPLAYS_ONBOARDING,
        targetPanel: OnboardingDrawerKey.FEEDBACK_ONBOARDING,
        onboardingPlatforms: replayOnboardingPlatforms,
        allPlatforms: replayOnboardingPlatforms,
      },
      initialRouterConfig: {
        location: {pathname: '/', query: {project: angular.id}},
      },
    });
    expect(result.current.currentProject).toBeUndefined();
  });

  it('should return the currentProject when currentPanel = targetPanel', () => {
    ProjectsStore.loadInitialData([javascript]);
    mockPageFilterStore([javascript]);
    const {result} = renderHookWithProviders(useCurrentProjectState, {
      initialProps: {
        currentPanel: OnboardingDrawerKey.REPLAYS_ONBOARDING,
        targetPanel: OnboardingDrawerKey.REPLAYS_ONBOARDING,
        onboardingPlatforms: replayOnboardingPlatforms,
        allPlatforms: replayOnboardingPlatforms,
      },
    });
    expect(result.current.currentProject).toBe(javascript);
  });

  it('uses the project query parameter when no selected projects are loaded', () => {
    ProjectsStore.loadInitialData([javascript, angular]);
    mockPageFilterStore([rust_1]);
    const {result} = renderHookWithProviders(useCurrentProjectState, {
      initialProps: {
        currentPanel: OnboardingDrawerKey.REPLAYS_ONBOARDING,
        targetPanel: OnboardingDrawerKey.REPLAYS_ONBOARDING,
        onboardingPlatforms: replayOnboardingPlatforms,
        allPlatforms: replayOnboardingPlatforms,
      },
      initialRouterConfig: {
        location: {pathname: '/', query: {project: angular.id}},
      },
    });
    expect(result.current.currentProject).toBe(angular);
  });

  it('should return the first project if global selection does not have onboarding', () => {
    ProjectsStore.loadInitialData([rust_1, rust_2]);
    mockPageFilterStore([rust_1, rust_2]);
    const {result} = renderHookWithProviders(useCurrentProjectState, {
      initialProps: {
        currentPanel: OnboardingDrawerKey.REPLAYS_ONBOARDING,
        targetPanel: OnboardingDrawerKey.REPLAYS_ONBOARDING,
        onboardingPlatforms: replayOnboardingPlatforms,
        allPlatforms: replayPlatforms,
      },
    });
    expect(result.current.currentProject).toBe(rust_1);
  });

  it('should return the first onboarding project', () => {
    ProjectsStore.loadInitialData([rust_1, javascript]);
    mockPageFilterStore([rust_1, javascript]);
    const {result} = renderHookWithProviders(useCurrentProjectState, {
      initialProps: {
        currentPanel: OnboardingDrawerKey.FEEDBACK_ONBOARDING,
        targetPanel: OnboardingDrawerKey.FEEDBACK_ONBOARDING,
        onboardingPlatforms: feedbackOnboardingPlatforms,
        allPlatforms: feedbackOnboardingPlatforms,
      },
    });
    expect(result.current.currentProject).toBe(rust_1);
  });

  it('should return the first project if no selection', () => {
    ProjectsStore.loadInitialData([rust_1, javascript]);
    mockPageFilterStore([]);
    const {result} = renderHookWithProviders(useCurrentProjectState, {
      initialProps: {
        currentPanel: OnboardingDrawerKey.REPLAYS_ONBOARDING,
        targetPanel: OnboardingDrawerKey.REPLAYS_ONBOARDING,
        onboardingPlatforms: replayOnboardingPlatforms,
        allPlatforms: replayPlatforms,
      },
    });
    expect(result.current.currentProject).toBe(javascript);
  });

  it('should return the first project if no selection and no projects have onboarding', () => {
    ProjectsStore.loadInitialData([rust_1, rust_2]);
    mockPageFilterStore([]);
    const {result} = renderHookWithProviders(useCurrentProjectState, {
      initialProps: {
        currentPanel: OnboardingDrawerKey.REPLAYS_ONBOARDING,
        targetPanel: OnboardingDrawerKey.REPLAYS_ONBOARDING,
        onboardingPlatforms: replayOnboardingPlatforms,
        allPlatforms: replayPlatforms,
      },
    });
    expect(result.current.currentProject).toBe(rust_1);
  });

  it('should override current project if setCurrentProjects is called', () => {
    ProjectsStore.loadInitialData([javascript, angular]);
    mockPageFilterStore([javascript, angular]);
    const {result} = renderHookWithProviders(useCurrentProjectState, {
      initialProps: {
        currentPanel: OnboardingDrawerKey.FEEDBACK_ONBOARDING,
        targetPanel: OnboardingDrawerKey.FEEDBACK_ONBOARDING,
        onboardingPlatforms: feedbackOnboardingPlatforms,
        allPlatforms: feedbackOnboardingPlatforms,
      },
    });
    expect(result.current.currentProject).toBe(javascript);
    act(() => result.current.setCurrentProject(angular));
    expect(result.current.currentProject).toBe(angular);
  });

  it('should update when the page filters store changes', () => {
    ProjectsStore.loadInitialData([javascript, angular]);
    mockPageFilterStore([angular]);
    const {result} = renderHookWithProviders(useCurrentProjectState, {
      initialProps: {
        currentPanel: OnboardingDrawerKey.FEEDBACK_ONBOARDING,
        targetPanel: OnboardingDrawerKey.FEEDBACK_ONBOARDING,
        onboardingPlatforms: feedbackOnboardingPlatforms,
        allPlatforms: feedbackOnboardingPlatforms,
      },
    });

    // Starts with angular
    expect(result.current.currentProject).toBe(angular);

    // Changes to javascript when page filters change
    act(() => mockPageFilterStore([javascript]));
    expect(result.current.currentProject).toBe(javascript);
  });
});
