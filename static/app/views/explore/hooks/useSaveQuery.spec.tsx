import type {ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {SpansQueryParamsProvider} from 'sentry/views/explore/spans/spansQueryParamsProvider';

import {useReplaySaveQuery, useSpansSaveQuery} from './useSaveQuery';

function Wrapper({children}: {children: ReactNode}) {
  return <SpansQueryParamsProvider>{children}</SpansQueryParamsProvider>;
}

describe('useSpansSaveQuery', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    PageFiltersStore.onInitializeUrlState(
      PageFiltersFixture({
        projects: [1],
        environments: ['production'],
        datetime: {
          start: '2024-01-01T00:00:00.000Z',
          end: '2024-01-01T01:00:00.000Z',
          period: '1h',
          utc: false,
        },
      })
    );
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('saves cross event queries', async () => {
    const saveQueryMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/`,
      method: 'POST',
      body: {id: 'new-query-id', name: 'New Query'},
    });

    const {result} = renderHookWithProviders(useSpansSaveQuery, {
      organization,
      additionalWrapper: Wrapper,
      initialRouterConfig: {
        location: {
          pathname: '/traces/',
          query: {
            query: 'span.op:db',
            mode: 'samples',
            field: ['span.op', 'span.duration'],
            sort: ['-span.duration'],
            crossEvents: JSON.stringify([
              {query: 'span.op:cache', type: 'spans'},
              {query: 'severity:error', type: 'logs'},
            ]),
          },
        },
      },
    });

    await result.current.saveQuery({name: 'New Query', starred: true});

    expect(saveQueryMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/explore/saved/`,
      expect.objectContaining({
        method: 'POST',
        data: expect.objectContaining({
          name: 'New Query',
          dataset: 'spans',
          projects: [1],
          environment: ['production'],
          start: '2024-01-01T00:00:00.000Z',
          end: '2024-01-01T01:00:00.000Z',
          statsPeriod: '1h',
          query: [
            expect.objectContaining({
              fields: ['span.op', 'span.duration'],
              orderby: '-span.duration',
              query: 'span.op:db',
            }),
          ],
          crossEvents: [
            {query: 'span.op:cache', type: 'spans'},
            {query: 'severity:error', type: 'logs'},
          ],
          starred: true,
        }),
      })
    );
  });

  it('updates cross event queries', async () => {
    const updateQueryMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/123/`,
      method: 'PUT',
      body: {id: '123', name: 'Existing Query'},
    });

    const {result} = renderHookWithProviders(useSpansSaveQuery, {
      organization,
      additionalWrapper: Wrapper,
      initialRouterConfig: {
        location: {
          pathname: '/traces/',
          query: {
            id: '123',
            title: 'Existing Query',
            query: 'span.status:ok',
            mode: 'samples',
            crossEvents: JSON.stringify([{query: 'severity:info', type: 'logs'}]),
          },
        },
      },
    });

    await result.current.updateQuery();

    expect(updateQueryMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/explore/saved/123/`,
      expect.objectContaining({
        method: 'PUT',
        data: expect.objectContaining({
          name: 'Existing Query',
          dataset: 'spans',
          crossEvents: [{query: 'severity:info', type: 'logs'}],
        }),
      })
    );
    expect(updateQueryMock.mock.calls[0]?.[1].data.queryPriority).toBeUndefined();
  });

  it('saves the selected query priority', async () => {
    const saveQueryMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/`,
      method: 'POST',
      body: {id: 'new-query-id', name: 'Fast query'},
    });

    const {result} = renderHookWithProviders(useSpansSaveQuery, {
      organization: OrganizationFixture({features: ['low-priority-queries']}),
      additionalWrapper: Wrapper,
      initialRouterConfig: {
        location: {
          pathname: '/traces/',
          query: {
            query: 'span.op:db',
            mode: 'samples',
            queryPriority: 'faster',
          },
        },
      },
    });

    await result.current.saveQuery({name: 'Fast query'});

    expect(saveQueryMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/explore/saved/`,
      expect.objectContaining({
        method: 'POST',
        data: expect.objectContaining({
          name: 'Fast query',
          queryPriority: 'faster',
        }),
      })
    );
  });

  it('omits query priority when the saved query fails to load', async () => {
    const savedQueryMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/123/`,
      statusCode: 500,
      body: {},
    });
    const updateQueryMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/123/`,
      method: 'PUT',
      body: {id: '123', name: 'Existing Query'},
    });

    const {result} = renderHookWithProviders(useSpansSaveQuery, {
      organization: OrganizationFixture({features: ['low-priority-queries']}),
      additionalWrapper: Wrapper,
      initialRouterConfig: {
        location: {
          pathname: '/traces/',
          query: {
            id: '123',
            title: 'Existing Query',
            query: 'span.op:db',
            mode: 'samples',
          },
        },
      },
    });

    await waitFor(() => {
      expect(savedQueryMock).toHaveBeenCalled();
    });
    await result.current.updateQuery();

    expect(updateQueryMock.mock.calls[0]?.[1].data.queryPriority).toBeUndefined();
  });

  it('omits query priority when extrapolation locks the control', async () => {
    const updateQueryMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/123/`,
      method: 'PUT',
      body: {id: '123', name: 'Existing Query'},
    });

    const {result} = renderHookWithProviders(useSpansSaveQuery, {
      organization: OrganizationFixture({features: ['low-priority-queries']}),
      additionalWrapper: Wrapper,
      initialRouterConfig: {
        location: {
          pathname: '/traces/',
          query: {
            id: '123',
            title: 'Existing Query',
            query: 'span.op:db',
            mode: 'samples',
            extrapolate: '0',
            queryPriority: 'faster',
          },
        },
      },
    });

    await result.current.updateQuery();

    expect(updateQueryMock.mock.calls[0]?.[1].data.queryPriority).toBeUndefined();
  });

  it('does not send query priority for a replay save', async () => {
    const saveQueryMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/`,
      method: 'POST',
      body: {id: 'replay-query', name: 'Replay query'},
    });

    const {result} = renderHookWithProviders(useReplaySaveQuery, {
      organization: OrganizationFixture({features: ['low-priority-queries']}),
      additionalWrapper: Wrapper,
      initialRouterConfig: {
        location: {
          pathname: '/replays/',
          query: {query: 'replay:1'},
        },
      },
    });

    await result.current.saveQuery({name: 'Replay query'});

    expect(saveQueryMock.mock.calls[0]?.[1].data.dataset).toBe('replays');
    expect(saveQueryMock.mock.calls[0]?.[1].data.queryPriority).toBeUndefined();
  });
});
