import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {makeTestQueryClient} from 'sentry-test/queryClient';
import {act, renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {Organization} from 'sentry/types/organization';
import {QueryClientProvider} from 'sentry/utils/queryClient';
import {OrganizationContext} from 'sentry/views/organizationContext';
import type {TraceResult} from 'sentry/views/traces/hooks/useTraces';
import type {SpanResults} from 'sentry/views/traces/hooks/useTraceSpans';
import {useTraceSpans} from 'sentry/views/traces/hooks/useTraceSpans';

function createTraceResult(trace?: Partial<TraceResult>): TraceResult {
  return {
    breakdowns: [],
    duration: 333,
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

function createWrapper(organization: Organization) {
  return function ({children}: {children?: React.ReactNode}) {
    return (
      <QueryClientProvider client={makeTestQueryClient()}>
        <OrganizationContext.Provider value={organization}>
          {children}
        </OrganizationContext.Provider>
      </QueryClientProvider>
    );
  };
}

describe('useTraceSpans', function () {
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

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    act(() => {
      ProjectsStore.loadInitialData([project]);
      PageFiltersStore.init();
      PageFiltersStore.onInitializeUrlState(
        {
          projects: [project].map(p => parseInt(p.id, 10)),
          environments: [],
          datetime: {
            period: '3d',
            start: null,
            end: null,
            utc: null,
          },
        },
        new Set()
      );
    });
  });

  it('handles querying the api', async function () {
    const trace = createTraceResult();

    const body: SpanResults<'id'> = {
      data: [{id: '0000000000000000'}],
      meta: {},
    };

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace/${trace.trace}/spans/`,
      body,
      match: [
        MockApiClient.matchQuery({
          project: [parseInt(project.id, 10)],
          field: ['id'],
          maxSpansPerTrace: 10,
          query: 'foo:bar',
          statsPeriod: '3d',
          mri: 'd:transactions/duration@millisecond',
          metricsMax: '456',
          metricsMin: '123',
          metricsOp: 'sum',
          metricsQuery: 'foo:bar',
        }),
      ],
    });

    const {result} = renderHook(useTraceSpans, {
      ...context,
      wrapper: createWrapper(organization),
      initialProps: {
        fields: ['id'],
        trace,
        datetime: {
          end: null,
          period: '3d',
          start: null,
          utc: null,
        },
        query: 'foo:bar',
        mri: 'd:transactions/duration@millisecond',
        metricsMax: '456',
        metricsMin: '123',
        metricsOp: 'sum',
        metricsQuery: 'foo:bar',
      },
    });

    await waitFor(() => result.current.isSuccess);
    expect(result.current.data).toEqual(body);
  });
});
