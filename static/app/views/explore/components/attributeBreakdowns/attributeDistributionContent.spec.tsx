import type {ReactNode} from 'react';

import {act, render, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {AttributeDistribution} from 'sentry/views/explore/components/attributeBreakdowns/attributeDistributionContent';
import {SpansQueryParamsProvider} from 'sentry/views/explore/spans/spansQueryParamsProvider';

function Wrapper({children}: {children: ReactNode}) {
  return <SpansQueryParamsProvider>{children}</SpansQueryParamsProvider>;
}

describe('AttributeDistribution', () => {
  beforeEach(() => {
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [1],
      environments: [],
      datetime: {period: '14d', start: null, end: null, utc: null},
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      method: 'GET',
      body: {data: [{'count()': 0}]},
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('clears the attribute breakdowns cursor when the explore query changes', async () => {
    const traceItemsStatsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/stats/',
      method: 'GET',
      body: {data: [{attribute_distributions: {data: {}}}]},
    });

    const {router} = render(<AttributeDistribution />, {
      additionalWrapper: Wrapper,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/explore/traces/',
          query: {
            query: 'span.op:db',
            attributeBreakdownsCursor: '1:0:0',
          },
        },
      },
    });

    await waitFor(() => expect(traceItemsStatsRequest).toHaveBeenCalledTimes(1));
    expect(traceItemsStatsRequest).toHaveBeenLastCalledWith(
      '/organizations/org-slug/trace-items/stats/',
      expect.objectContaining({
        query: expect.objectContaining({cursor: '1:0:0', query: 'span.op:db'}),
      })
    );

    act(() => {
      router.navigate({
        pathname: '/organizations/org-slug/explore/traces/',
        search: 'query=span.op%3Ahttp&attributeBreakdownsCursor=1%3A0%3A0',
      });
    });

    await waitFor(() =>
      expect(traceItemsStatsRequest.mock.calls.length).toBeGreaterThanOrEqual(2)
    );
    expect(traceItemsStatsRequest).toHaveBeenNthCalledWith(
      2,
      '/organizations/org-slug/trace-items/stats/',
      expect.objectContaining({
        query: expect.not.objectContaining({cursor: '1:0:0'}),
      })
    );
    expect(traceItemsStatsRequest).toHaveBeenNthCalledWith(
      2,
      '/organizations/org-slug/trace-items/stats/',
      expect.objectContaining({
        query: expect.objectContaining({query: 'span.op:http'}),
      })
    );

    await waitFor(() =>
      expect(router.location.query.attributeBreakdownsCursor).toBeUndefined()
    );
  });

  it('clears the attribute breakdowns cursor when page filters change', async () => {
    const traceItemsStatsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/stats/',
      method: 'GET',
      body: {data: [{attribute_distributions: {data: {}}}]},
    });

    const {router} = render(<AttributeDistribution />, {
      additionalWrapper: Wrapper,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/explore/traces/',
          query: {
            attributeBreakdownsCursor: '1:0:0',
          },
        },
      },
    });

    await waitFor(() => expect(traceItemsStatsRequest).toHaveBeenCalledTimes(1));
    expect(traceItemsStatsRequest).toHaveBeenLastCalledWith(
      '/organizations/org-slug/trace-items/stats/',
      expect.objectContaining({
        query: expect.objectContaining({cursor: '1:0:0', project: [1]}),
      })
    );

    act(() => {
      PageFiltersStore.updateProjects([2], null);
    });

    await waitFor(() =>
      expect(traceItemsStatsRequest.mock.calls.length).toBeGreaterThanOrEqual(2)
    );
    expect(traceItemsStatsRequest).toHaveBeenNthCalledWith(
      2,
      '/organizations/org-slug/trace-items/stats/',
      expect.objectContaining({
        query: expect.not.objectContaining({cursor: '1:0:0'}),
      })
    );
    expect(traceItemsStatsRequest).toHaveBeenNthCalledWith(
      2,
      '/organizations/org-slug/trace-items/stats/',
      expect.objectContaining({
        query: expect.objectContaining({project: [2]}),
      })
    );

    await waitFor(() =>
      expect(router.location.query.attributeBreakdownsCursor).toBeUndefined()
    );
  });
});
