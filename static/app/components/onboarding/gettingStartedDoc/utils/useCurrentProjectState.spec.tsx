import {createMemoryHistory, Route, Router, RouterContext} from 'react-router';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import useCurrentProjectState from 'sentry/components/onboarding/gettingStartedDoc/utils/useCurrentProjectState';
import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import {
  customMetricOnboardingPlatforms,
  customMetricPlatforms,
  feedbackOnboardingPlatforms,
  replayOnboardingPlatforms,
  replayPlatforms,
} from 'sentry/data/platformCategories';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {Project} from 'sentry/types/project';
import {RouteContext} from 'sentry/views/routeContext';

function createWrapper(projectSlug?: string) {
  const memoryHistory = createMemoryHistory();

  if (projectSlug) {
    memoryHistory.push(`/${projectSlug}/`);
  }

  return function Wrapper({children}) {
    return (
      <Router
        history={memoryHistory}
        render={props => {
          return (
            <RouteContext.Provider value={props}>
              <RouterContext {...props} />
            </RouteContext.Provider>
          );
        }}
      >
        <Route path="/:projectId/" component={() => children} />
        <Route path="/" component={() => children} />
      </Router>
    );
  };
}

function mockPageFilterStore(projects: Project[]) {
  PageFiltersStore.init();
  PageFiltersStore.onInitializeUrlState(
    {
      projects: projects.map(p => parseInt(p.id, 10)),
      environments: [],
      datetime: {
        period: '7d',
        start: null,
        end: null,
        utc: null,
      },
    },
    new Set()
  );
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
    const {result} = renderHook(useCurrentProjectState, {
      initialProps: {
        currentPanel: SidebarPanelKey.REPLAYS_ONBOARDING,
        targetPanel: SidebarPanelKey.FEEDBACK_ONBOARDING,
        onboardingPlatforms: feedbackOnboardingPlatforms,
        allPlatforms: feedbackOnboardingPlatforms,
      },
      wrapper: createWrapper(),
    });
    expect(result.current.currentProject).toBe(undefined);
  });

  it('should return currentProject=undefined when project url param is present and currentPanel != targetPanel', () => {
    ProjectsStore.loadInitialData([javascript, angular]);
    mockPageFilterStore([javascript, angular]);
    const {result} = renderHook(useCurrentProjectState, {
      initialProps: {
        currentPanel: SidebarPanelKey.REPLAYS_ONBOARDING,
        targetPanel: SidebarPanelKey.METRICS_ONBOARDING,
        onboardingPlatforms: customMetricOnboardingPlatforms,
        allPlatforms: customMetricPlatforms,
      },
      wrapper: createWrapper(angular.id),
    });
    expect(result.current.currentProject).toBe(undefined);
  });

  it('should return the currentProject when currentPanel = targetPanel', () => {
    ProjectsStore.loadInitialData([javascript]);
    mockPageFilterStore([javascript]);
    const {result} = renderHook(useCurrentProjectState, {
      initialProps: {
        currentPanel: SidebarPanelKey.METRICS_ONBOARDING,
        targetPanel: SidebarPanelKey.METRICS_ONBOARDING,
        onboardingPlatforms: customMetricOnboardingPlatforms,
        allPlatforms: customMetricPlatforms,
      },
      wrapper: createWrapper(),
    });
    expect(result.current.currentProject).toBe(javascript);
  });

  it('should return the currentProject when project url param is present and currentPanel = targetPanel', () => {
    ProjectsStore.loadInitialData([javascript, angular]);
    mockPageFilterStore([javascript, angular]);
    const {result} = renderHook(useCurrentProjectState, {
      initialProps: {
        currentPanel: SidebarPanelKey.METRICS_ONBOARDING,
        targetPanel: SidebarPanelKey.METRICS_ONBOARDING,
        onboardingPlatforms: customMetricOnboardingPlatforms,
        allPlatforms: customMetricPlatforms,
      },
      wrapper: createWrapper(javascript.id),
    });
    expect(result.current.currentProject).toBe(javascript);
  });

  it('should return the first project if global selection does not have onboarding', () => {
    ProjectsStore.loadInitialData([rust_1, rust_2]);
    mockPageFilterStore([rust_1, rust_2]);
    const {result} = renderHook(useCurrentProjectState, {
      initialProps: {
        currentPanel: SidebarPanelKey.REPLAYS_ONBOARDING,
        targetPanel: SidebarPanelKey.REPLAYS_ONBOARDING,
        onboardingPlatforms: replayOnboardingPlatforms,
        allPlatforms: replayPlatforms,
      },
      wrapper: createWrapper(),
    });
    expect(result.current.currentProject).toBe(rust_1);
  });

  it('should return the first onboarding project', () => {
    ProjectsStore.loadInitialData([rust_1, javascript]);
    mockPageFilterStore([rust_1, javascript]);
    const {result} = renderHook(useCurrentProjectState, {
      initialProps: {
        currentPanel: SidebarPanelKey.FEEDBACK_ONBOARDING,
        targetPanel: SidebarPanelKey.FEEDBACK_ONBOARDING,
        onboardingPlatforms: feedbackOnboardingPlatforms,
        allPlatforms: feedbackOnboardingPlatforms,
      },
      wrapper: createWrapper(),
    });
    expect(result.current.currentProject).toBe(rust_1);
  });

  it('should return the first project if no selection', () => {
    ProjectsStore.loadInitialData([rust_1, javascript]);
    mockPageFilterStore([]);
    const {result} = renderHook(useCurrentProjectState, {
      initialProps: {
        currentPanel: SidebarPanelKey.REPLAYS_ONBOARDING,
        targetPanel: SidebarPanelKey.REPLAYS_ONBOARDING,
        onboardingPlatforms: replayOnboardingPlatforms,
        allPlatforms: replayPlatforms,
      },
      wrapper: createWrapper(),
    });
    expect(result.current.currentProject).toBe(javascript);
  });

  it('should return undefined if no selection and no projects have onboarding', () => {
    ProjectsStore.loadInitialData([rust_1, rust_2]);
    mockPageFilterStore([]);
    const {result} = renderHook(useCurrentProjectState, {
      initialProps: {
        currentPanel: SidebarPanelKey.REPLAYS_ONBOARDING,
        targetPanel: SidebarPanelKey.REPLAYS_ONBOARDING,
        onboardingPlatforms: replayOnboardingPlatforms,
        allPlatforms: replayPlatforms,
      },
      wrapper: createWrapper(),
    });
    expect(result.current.currentProject).toBe(undefined);
  });

  it('should override current project if setCurrentProjects is called', () => {
    ProjectsStore.loadInitialData([javascript, angular]);
    mockPageFilterStore([javascript, angular]);
    const {result} = renderHook(useCurrentProjectState, {
      initialProps: {
        currentPanel: SidebarPanelKey.FEEDBACK_ONBOARDING,
        targetPanel: SidebarPanelKey.FEEDBACK_ONBOARDING,
        onboardingPlatforms: feedbackOnboardingPlatforms,
        allPlatforms: feedbackOnboardingPlatforms,
      },
      wrapper: createWrapper(),
    });
    expect(result.current.currentProject).toBe(javascript);
    act(() => result.current.setCurrentProject(angular));
    expect(result.current.currentProject).toBe(angular);
  });
});
