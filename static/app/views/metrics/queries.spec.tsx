import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {PageFilters} from 'sentry/types/core';
import {useLocation} from 'sentry/utils/useLocation';
import importedUsePageFilters from 'sentry/utils/usePageFilters';
import {MetricsContextProvider} from 'sentry/views/metrics/context';
import {Queries} from 'sentry/views/metrics/queries';

jest.mock('sentry/utils/useLocation');
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

function renderMockRequests({orgSlug, projectId}: {orgSlug: string; projectId: string}) {
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
    url: `/organizations/${orgSlug}/metrics/tags/`,
    method: 'GET',
    body: [],
  });
}

describe('Queries', function () {
  it('span.duration shall be the default value in the "visualization" field', async function () {
    const {organization, project, router} = initializeOrg();

    jest.mocked(useLocation).mockReturnValue(router.location);

    usePageFilters.mockImplementation(() =>
      makeFilterProps({projects: [Number(project.id)]})
    );

    renderMockRequests({orgSlug: organization.slug, projectId: project.slug});

    render(
      <MetricsContextProvider>
        <Queries />
      </MetricsContextProvider>
    );

    const visualizeInputField = await screen.findByPlaceholderText('Select a metric');
    expect(visualizeInputField).toHaveValue('span.duration');
  });

  it('span.duration shall NOT be the default value in the "visualization" field if query params', async function () {
    const {organization, project, router} = initializeOrg();

    jest.mocked(useLocation).mockReturnValue({
      ...router.location,
      query: {
        widgets: JSON.stringify([
          {
            aggregation: 'avg',
            condition: undefined,
            displayType: 'line',
            focusedSeries: undefined,
            groupBy: undefined,
            id: 0,
            isHidden: false,
            mri: 'd:transactions/duration@millisecond',
            overlays: ['samples'],
            powerUserMode: false,
            query: '',
            sort: {name: undefined, order: 'asc'},
            type: 1,
          },
        ]),
      },
    });

    renderMockRequests({orgSlug: organization.slug, projectId: project.slug});

    render(
      <MetricsContextProvider>
        <Queries />
      </MetricsContextProvider>
    );

    const visualizeInputField = await screen.findByPlaceholderText('Select a metric');
    expect(visualizeInputField).toHaveValue('transaction.duration');
  });
});
