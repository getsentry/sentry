import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';

import {renderHook} from 'sentry-test/reactTestingLibrary';

import {updateProjects} from 'sentry/components/pageFilters/actions';
import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {useDefaultToAllProjects} from 'sentry/views/insights/common/utils/useDefaultToAllProjects';

jest.mock('sentry/components/pageFilters/actions');

const pageFilterSelection = PageFiltersFixture({
  projects: [],
  datetime: {
    period: '14d',
    start: null,
    end: null,
    utc: false,
  },
});

describe('useDefaultToAllProjects', () => {
  beforeEach(() => {
    PageFiltersStore.onInitializeUrlState(pageFilterSelection);
  });

  afterEach(() => {
    jest.clearAllMocks();
    PageFiltersStore.reset();
    ProjectsStore.reset();
  });
  it('should default to all projects when no projects are selected and user has no team projects', () => {
    const nonMemberProject = ProjectFixture({isMember: false});
    ProjectsStore.loadInitialData([nonMemberProject]);
    renderHook(useDefaultToAllProjects);
    expect(updateProjects).toHaveBeenCalledWith([-1], undefined, undefined, {
      save: true,
    });
  });

  it('should not update projects when there are no projects selected and user has team projects', () => {
    ProjectsStore.loadInitialData([ProjectFixture()]);
    renderHook(useDefaultToAllProjects);
    expect(updateProjects).not.toHaveBeenCalled();
  });

  it('should not update projects when there are projects selected', () => {
    PageFiltersStore.onInitializeUrlState(
      PageFiltersFixture({
        ...pageFilterSelection,
        projects: [1, 2],
      })
    );
    renderHook(useDefaultToAllProjects);
    expect(updateProjects).not.toHaveBeenCalled();
  });
});
