import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {useProfileFilters} from 'sentry/utils/profiling/hooks/useProfileFilters';
import ProfilingContent from 'sentry/views/profiling/content';

jest.mock('sentry/utils/profiling/hooks/useProfileFilters');

describe('profiling Onboarding View > Unsupported Banner', function () {
  const {router} = initializeOrg({
    router: {
      location: {query: {}, search: '', pathname: '/test/'},
    },
  });

  beforeEach(function () {
    jest.resetAllMocks();
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(
      {
        projects: [],
        environments: [],
        datetime: {start: null, end: null, period: '24h', utc: null},
      },
      new Set()
    );
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      method: 'GET',
      body: {data: []},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/profiling/filters/',
      method: 'GET',
      body: {data: []},
    });
    jest.mocked(useProfileFilters).mockReturnValue({});
  });

  it('Displays unsupported banner for unsupported projects', async function () {
    ProjectsStore.loadInitialData([ProjectFixture({platform: 'nintendo-switch'})]);
    render(<ProfilingContent location={router.location} />);
    expect(await screen.findByTestId('unsupported-alert')).toBeInTheDocument();
  });

  it('Does not show unsupported banner for supported projects', async function () {
    ProjectsStore.loadInitialData([
      ProjectFixture({platform: 'android', hasProfiles: false}),
    ]);
    render(<ProfilingContent location={router.location} />);
    expect(await screen.findByTestId('profiling-upgrade')).toBeInTheDocument();
    expect(screen.queryByTestId('unsupported-alert')).not.toBeInTheDocument();
  });
});
