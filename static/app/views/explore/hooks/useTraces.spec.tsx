import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/components/pageFilters/store';
import ProjectsStore from 'sentry/stores/projectsStore';

import {useTraces, type TraceResult} from './useTraces';

function createTraceResult(trace?: Partial<TraceResult>): TraceResult {
  return {
    breakdowns: [],
    duration: 333,
    rootDuration: 333,
    end: 456,
    matchingSpans: 1,
    name: 'name',
    numErrors: 1,
    numOccurrences: 1,
    numSpans: 2,
    project: 'project',
    slices: 10,
    start: 123,
    trace: '00000000000000000000000000000000',
    ...trace,
  };
}

describe('useTraces', () => {
  const project = ProjectFixture();
  const organization = OrganizationFixture();
  const context = initializeOrg({
    organization,
    projects: [project],
    router: {
      location: {
        pathname: '/organizations/org-slug/issues/',
        query: {project: project.id},
      },
      params: {},
    },
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    act(() => {
      ProjectsStore.loadInitialData([project]);
      PageFiltersStore.init();
      PageFiltersStore.onInitializeUrlState({
        projects: [project].map(p => parseInt(p.id, 10)),
        environments: [],
        datetime: {
          period: '3d',
          start: null,
          end: null,
          utc: null,
        },
      });
    });
  });

  it('handles querying the api', async () => {
    const trace = createTraceResult();

    const body = {
      data: [trace],
      meta: {},
    };

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/traces/`,
      body,
      match: [
        MockApiClient.matchQuery({
          project: [parseInt(project.id, 10)],
          query: 'foo:bar',
          statsPeriod: '3d',
          per_page: 10,
          breakdownSlices: 40,
        }),
      ],
    });

    const {result} = renderHookWithProviders(useTraces, {
      ...context,
      initialProps: {
        datetime: {
          end: null,
          period: '3d',
          start: null,
          utc: null,
        },
        limit: 10,
        query: 'foo:bar',
      },
    });

    await waitFor(() => result.current.isSuccess);
    expect(result.current.data).toEqual(body);
  });
});
