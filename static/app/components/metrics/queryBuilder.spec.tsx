import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {QueryBuilder} from 'sentry/components/metrics/queryBuilder';
import type {MetricsQueryApiResponse, PageFilters} from 'sentry/types';
import type {MetricsQuery} from 'sentry/utils/metrics/types';
import {VirtualMetricsContextProvider} from 'sentry/utils/metrics/virtualMetricsContext';
import importedUsePageFilters from 'sentry/utils/usePageFilters';

jest.mock('sentry/utils/usePageFilters');

const usePageFilters = jest.mocked(importedUsePageFilters);

const makeFilterProps = (
  filters: Partial<PageFilters>
): ReturnType<typeof importedUsePageFilters> => {
  return {
    isReady: true,
    shouldPersist: true,
    desyncedFilters: new Set(),
    pinnedFilters: new Set(),
    selection: {
      projects: [1],
      environments: ['prod'],
      datetime: {start: new Date(), end: new Date(), period: '14d', utc: true},
      ...filters,
    },
  };
};

const makeMetricsQuery = (projectId: string): MetricsQuery => {
  return {
    aggregation: 'count',
    condition: 1,
    groupBy: [],
    mri: `v:custom/span_attribute|${projectId}@none`,
    query: '',
  };
};

function renderMockRequests({
  orgSlug,
  projectId,
  metricsQueryApiResponse,
}: {
  orgSlug: string;
  projectId: string;
  metricsQueryApiResponse?: Partial<MetricsQueryApiResponse>;
}) {
  MockApiClient.addMockResponse({
    url: `/organizations/${orgSlug}/metrics/tags/`,
    body: [],
  });
  MockApiClient.addMockResponse({
    url: `/organizations/${orgSlug}/metrics/meta/`,
    body: [],
  });
  MockApiClient.addMockResponse({
    url: `/organizations/${orgSlug}/metrics/query/`,
    method: 'POST',
    body: metricsQueryApiResponse ?? {
      data: [
        [
          {
            by: {
              mri: `c:custom/span_attribute_${projectId}@none`,
            },
            totals: 2703.0,
          },
        ],
      ],
      start: '2024-07-16T21:00:00Z',
      end: '2024-07-17T22:00:00Z',
    },
  });
  MockApiClient.addMockResponse({
    url: `/organizations/${orgSlug}/metrics/extraction-rules/`,
    body: [
      {
        spanAttribute: 'span_attribute',
        aggregates: ['count'],
        unit: 'none',
        tags: ['browser.name'],
        conditions: [
          {
            id: 1,
            value: '',
            mris: [`c:custom/span_attribute_${projectId}@none`],
          },
        ],
        projectId,
        createdById: 3242858,
        dateAdded: '2024-07-17T07:06:33.253094Z',
        dateUpdated: '2024-07-17T21:27:54.742586Z',
      },
    ],
  });
}

describe('Metric Query Builder', function () {
  const {project, organization} = initializeOrg();

  it('shall display cardinality limit warning', async function () {
    renderMockRequests({orgSlug: organization.slug, projectId: project.id});

    usePageFilters.mockImplementation(() =>
      makeFilterProps({projects: [Number(project.id)]})
    );

    render(
      <VirtualMetricsContextProvider>
        <QueryBuilder
          onChange={jest.fn()}
          index={0}
          metricsQuery={makeMetricsQuery(project.id)}
          projects={[Number(project.id)]}
        />
      </VirtualMetricsContextProvider>
    );

    expect(
      await screen.findByLabelText('Exceeding the cardinality limit warning')
    ).toBeInTheDocument();
  });

  it('shall NOT display cardinality limit warning', async function () {
    renderMockRequests({
      orgSlug: organization.slug,
      projectId: project.id,
      metricsQueryApiResponse: {
        data: [],
      },
    });

    usePageFilters.mockImplementation(() =>
      makeFilterProps({projects: [Number(project.id)]})
    );

    render(
      <VirtualMetricsContextProvider>
        <QueryBuilder
          onChange={jest.fn()}
          index={0}
          metricsQuery={makeMetricsQuery(project.id)}
          projects={[Number(project.id)]}
        />
      </VirtualMetricsContextProvider>
    );

    expect(await screen.findByText(/query/i)).toBeInTheDocument();

    expect(
      screen.queryByLabelText('Exceeding the cardinality limit warning')
    ).not.toBeInTheDocument();
  });
});
