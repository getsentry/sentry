import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Project} from 'sentry/types/project';
import {useCrossPlatformProject} from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';

function initializePageFilters(projects: number[]) {
  PageFiltersStore.onInitializeUrlState(
    PageFiltersFixture({
      datetime: {
        period: '10d',
        start: null,
        end: null,
        utc: false,
      },
      projects,
    })
  );
}

describe('useCrossPlatformProject', () => {
  let mockProject: Project;
  beforeEach(() => {
    mockProject = ProjectFixture({platform: 'flutter'});
    PageFiltersStore.init();
    ProjectsStore.loadInitialData([mockProject]);
  });

  afterEach(() => {
    PageFiltersStore.reset();
    ProjectsStore.reset();
  });

  it('returns null for project if >1 project is selected', () => {
    initializePageFilters([1, 2, 3]);

    const {result} = renderHookWithProviders(useCrossPlatformProject);

    const {project, isProjectCrossPlatform} = result.current;

    expect(project).toBeNull();
    expect(isProjectCrossPlatform).toBe(false);
  });

  it('returns the corresponding project data if a single project is selected', () => {
    initializePageFilters([parseInt(mockProject.id, 10)]);

    const {result} = renderHookWithProviders(useCrossPlatformProject);

    const {project, isProjectCrossPlatform, selectedPlatform} = result.current;

    expect(project).toBe(mockProject);
    expect(isProjectCrossPlatform).toBe(true);

    // The default selection result is "Android"
    expect(selectedPlatform).toBe('Android');
  });

  it('returns false for isProjectCrossPlatform if project is not cross platform', () => {
    const testProject = ProjectFixture({platform: 'python'});

    ProjectsStore.loadInitialData([testProject]);
    initializePageFilters([parseInt(testProject.id, 10)]);

    const {result} = renderHookWithProviders(useCrossPlatformProject);

    const {project, isProjectCrossPlatform} = result.current;

    expect(project).toBe(testProject);
    expect(isProjectCrossPlatform).toBe(false);
  });
});
