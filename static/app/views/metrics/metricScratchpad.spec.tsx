import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import type {PageFilters} from 'sentry/types/core';
import type {MetricsQueryApiResponse} from 'sentry/types/metrics';
import importedUsePageFilters from 'sentry/utils/usePageFilters';
import {MetricsContextProvider} from 'sentry/views/metrics/context';
import {MetricScratchpad} from 'sentry/views/metrics/scratchpad';

jest.mock('sentry/components/metrics/chart/chart');
jest.mock('echarts/core', () => {
  return {
    connect: jest.fn(),
    use: jest.fn(),
  };
});
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
    url: `/organizations/${orgSlug}/metrics/meta/`,
    body: [
      {
        type: 'd',
        name: 'duration',
        unit: 'millisecond',
        mri: 'd:transactions/duration@millisecond',
        operations: ['avg', 'count'],
        projectIds: [projectId],
        blockingStatus: [],
      },
      {
        type: 'd',
        name: 'duration',
        unit: 'millisecond',
        mri: 'd:spans/duration@millisecond',
        operations: ['avg', 'count'],
        projectIds: [projectId],
        blockingStatus: [],
      },
    ],
  });
  MockApiClient.addMockResponse({
    url: `/organizations/${orgSlug}/metrics/extraction-rules/`,
    method: 'GET',
    body: [
      {
        aggregates: ['count'],
        conditions: [{id: 102, value: '', mris: ['c:custom/span_attribute_102@none']}],
        createdById: 3142223,
        dateAdded: '2024-07-29T12:04:23.196785Z',
        dateUpdated: '2024-07-29T12:04:23.197008Z',
        projectId,
        spanAttribute: 'A',
        tags: ['release', 'environment'],
        unit: 'none',
      },
    ],
  });
  MockApiClient.addMockResponse({
    url: `/organizations/${orgSlug}/releases/stats/`,
    body: [],
  });
  MockApiClient.addMockResponse({
    url: `/organizations/${orgSlug}/metrics/query/`,
    method: 'POST',
    body: metricsQueryApiResponse ?? {
      data: [
        [
          {
            by: {},
            totals: 1000.0,
            series: [null, 1000.0],
          },
        ],
      ],
      meta: [
        [
          {
            name: 'aggregate_value',
            type: 'Float64',
          },
          {
            group_bys: [],
            order: 'DESC',
            limit: 715,
            has_more: false,
            unit_family: null,
            unit: null,
            scaling_factor: null,
          },
        ],
      ],
      start: '2024-04-25T00:00:00Z',
      end: '2024-08-01T00:00:00Z',
      intervals: ['2024-07-18T00:00:00Z', '2024-07-25T00:00:00Z'],
    },
  });
}

describe('metric Scratchpad', function () {
  it('render summary table if data', async function () {
    const {organization, project} = initializeOrg();

    usePageFilters.mockImplementation(() =>
      makeFilterProps({projects: [Number(project.id)]})
    );

    renderMockRequests({orgSlug: organization.slug, projectId: project.id});

    render(
      <MetricsContextProvider>
        <MetricScratchpad />
      </MetricsContextProvider>
    );

    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

    expect(screen.getByTestId('summary-table')).toBeInTheDocument();
  });

  it('do NOT render summary table if there is no data', async function () {
    const {organization, project} = initializeOrg();

    usePageFilters.mockImplementation(() =>
      makeFilterProps({projects: [Number(project.id)]})
    );

    renderMockRequests({
      orgSlug: organization.slug,
      projectId: project.id,
      metricsQueryApiResponse: {
        data: [],
        meta: [],
      },
    });

    render(
      <MetricsContextProvider>
        <MetricScratchpad />
      </MetricsContextProvider>
    );

    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

    expect(screen.queryByTestId('summary-table')).not.toBeInTheDocument();
  });
});
