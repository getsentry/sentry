import type React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {MetricQuerySelect} from 'sentry/components/metrics/metricQuerySelect';
import type {MetricsQueryApiResponse, PageFilters} from 'sentry/types';
import {
  useVirtualMetricsContext,
  VirtualMetricsContextProvider,
} from 'sentry/utils/metrics/virtualMetricsContext';
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

const SELECTED_MRI = 'c:custom/span_attribute_66@none';

function MetricQuerySelectWithMRI(
  props: Omit<React.ComponentProps<typeof MetricQuerySelect>, 'mri'>
) {
  const {getVirtualMRI} = useVirtualMetricsContext();
  const mri = getVirtualMRI(SELECTED_MRI);

  if (!mri) {
    return null;
  }

  return <MetricQuerySelect {...props} mri={mri} />;
}

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
    url: `/organizations/${orgSlug}/metrics/query/`,
    method: 'POST',
    body: metricsQueryApiResponse ?? {
      data: [
        [
          {
            by: {
              mri: SELECTED_MRI,
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
    method: 'GET',
    body: [
      {
        spanAttribute: 'span.duration',
        aggregates: ['count'],
        unit: 'millisecond',
        tags: ['browser.name'],
        conditions: [
          {
            id: 66,
            value: '',
            mris: ['c:custom/span_attribute_66@none'],
          },
        ],
        projectId,
        createdById: 3242858,
        dateAdded: '2024-07-17T07:06:33.253094Z',
        dateUpdated: '2024-07-17T21:27:54.742586Z',
      },
    ],
  });
  MockApiClient.addMockResponse({
    url: `/organizations/${orgSlug}/metrics/meta/`,
    method: 'GET',
    body: [],
  });
}

describe('Metric Query Select', function () {
  const {project, organization} = initializeOrg();

  it('shall display cardinality limit warning', async function () {
    renderMockRequests({orgSlug: organization.slug, projectId: project.id});

    usePageFilters.mockImplementation(() =>
      makeFilterProps({projects: [Number(project.id)]})
    );

    render(
      <VirtualMetricsContextProvider>
        <MetricQuerySelectWithMRI onChange={jest.fn()} conditionId={66} />
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
        <MetricQuerySelectWithMRI onChange={jest.fn()} conditionId={66} />
      </VirtualMetricsContextProvider>
    );

    expect(await screen.findByText(/query/i)).toBeInTheDocument();

    expect(
      screen.queryByLabelText('Exceeding the cardinality limit warning')
    ).not.toBeInTheDocument();
  });
});
