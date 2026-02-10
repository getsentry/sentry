import {LocationFixture} from 'sentry-fixture/locationFixture';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';

import {renderHook} from 'sentry-test/reactTestingLibrary';

import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';

jest.mock('sentry/components/pageFilters/usePageFilters');
jest.mock('sentry/utils/useLocation');

function mockPageFilters(projects: number[]) {
  jest.mocked(usePageFilters).mockReturnValue(
    PageFilterStateFixture({
      selection: {
        datetime: {
          period: '10d',
          start: null,
          end: null,
          utc: false,
        },
        environments: [],
        projects,
      },
    })
  );
}

describe('useCrossPlatformProject', () => {
  let mockProject: Project;
  beforeEach(() => {
    jest.clearAllMocks();

    mockProject = ProjectFixture({platform: 'flutter'});
    jest.mocked(useLocation).mockReturnValue(LocationFixture());
    ProjectsStore.loadInitialData([mockProject]);
  });

  it('returns null for project if >1 project is selected', () => {
    mockPageFilters([1, 2, 3]);

    const {result} = renderHook(useCrossPlatformProject);

    const {project, isProjectCrossPlatform} = result.current;

    expect(project).toBeNull();
    expect(isProjectCrossPlatform).toBe(false);
  });

  it('returns the corresponding project data if a single project is selected', () => {
    mockPageFilters([parseInt(mockProject.id, 10)]);

    const {result} = renderHook(useCrossPlatformProject);

    const {project, isProjectCrossPlatform, selectedPlatform} = result.current;

    expect(project).toBe(mockProject);
    expect(isProjectCrossPlatform).toBe(true);

    // The default selection result is "Android"
    expect(selectedPlatform).toBe('Android');
  });

  it('returns false for isProjectCrossPlatform if project is not cross platform', () => {
    const testProject = ProjectFixture({platform: 'python'});

    ProjectsStore.loadInitialData([testProject]);
    mockPageFilters([parseInt(testProject.id, 10)]);

    const {result} = renderHook(useCrossPlatformProject);

    const {project, isProjectCrossPlatform} = result.current;

    expect(project).toBe(testProject);
    expect(isProjectCrossPlatform).toBe(false);
  });
});
