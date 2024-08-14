import {LocationFixture} from 'sentry-fixture/locationFixture';
import {ProjectFixture} from 'sentry-fixture/project';

import {renderHook} from 'sentry-test/reactTestingLibrary';

import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';

jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/useProjects');

function mockPageFilters(projects: number[]) {
  jest.mocked(usePageFilters).mockReturnValue({
    isReady: true,
    desyncedFilters: new Set(),
    pinnedFilters: new Set(),
    shouldPersist: true,
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
  });
}

function mockProjects(projects: Project[]) {
  jest.mocked(useProjects).mockReturnValue({
    fetchError: null,
    fetching: false,
    hasMore: false,
    initiallyLoaded: false,
    onSearch: jest.fn(),
    reloadProjects: jest.fn(),
    placeholders: [],
    projects,
  });
}

describe('useCrossPlatformProject', () => {
  let mockProject: Project;
  beforeEach(() => {
    jest.clearAllMocks();

    mockProject = ProjectFixture({platform: 'flutter'});
    jest.mocked(useLocation).mockReturnValue(LocationFixture());
    mockProjects([mockProject]);
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

    mockProjects([testProject]);
    mockPageFilters([parseInt(testProject.id, 10)]);

    const {result} = renderHook(useCrossPlatformProject);

    const {project, isProjectCrossPlatform} = result.current;

    expect(project).toBe(testProject);
    expect(isProjectCrossPlatform).toBe(false);
  });
});
