import {PageFiltersFixture, PageFilterStateFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';

import {renderHook} from 'sentry-test/reactTestingLibrary';

import {updateProjects} from 'sentry/components/pageFilters/actions';
import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import ProjectsStore from 'sentry/stores/projectsStore';
import {useDefaultToAllProjects} from 'sentry/views/insights/common/utils/useDefaultToAllProjects';

jest.mock('sentry/components/pageFilters/usePageFilters');
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
  afterEach(() => {
    jest.clearAllMocks();
    ProjectsStore.reset();
  });
  it('should default to all projects when no projects are selected and user has no team projects', () => {
    jest.mocked(usePageFilters).mockReturnValue(
      PageFilterStateFixture({
        selection: pageFilterSelection,
      })
    );
    const nonMemberProject = ProjectFixture({isMember: false});
    ProjectsStore.loadInitialData([nonMemberProject]);
    renderHook(useDefaultToAllProjects);
    expect(updateProjects).toHaveBeenCalledWith([-1], undefined, {
      save: true,
    });
  });

  it('should not update projects when there are no projects selected and user has team projects', () => {
    jest.mocked(usePageFilters).mockReturnValue(
      PageFilterStateFixture({
        selection: pageFilterSelection,
      })
    );
    ProjectsStore.loadInitialData([ProjectFixture()]);
    renderHook(useDefaultToAllProjects);
    expect(updateProjects).not.toHaveBeenCalled();
  });

  it('should not update projects when there are projects selected', () => {
    jest.mocked(usePageFilters).mockReturnValue(
      PageFilterStateFixture({
        selection: {
          ...pageFilterSelection,
          projects: [1, 2],
        },
      })
    );
    renderHook(useDefaultToAllProjects);
    expect(updateProjects).not.toHaveBeenCalled();
  });
});
