import type {ReactNode} from 'react';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useExploreSpansTable} from 'sentry/views/explore/hooks/useExploreSpansTable';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {
  useQueryParamsFields,
  useSetQueryParamsFields,
} from 'sentry/views/explore/queryParams/context';
import {SpansQueryParamsProvider} from 'sentry/views/explore/spans/spansQueryParamsProvider';

jest.mock('sentry/components/pageFilters/usePageFilters');

function Wrapper({children}: {children: ReactNode}) {
  return <SpansQueryParamsProvider>{children}</SpansQueryParamsProvider>;
}

function useTestExploreSpansTable(query: string) {
  const fields = useQueryParamsFields();
  const setFields = useSetQueryParamsFields();
  const spansTable = useExploreSpansTable({
    query,
    enabled: true,
    limit: 10,
  });

  return {fields, setFields, spansTable};
}

describe('useExploreSpansTable', () => {
  beforeEach(() => {
    jest.mocked(usePageFilters).mockReturnValue(PageFilterStateFixture());
    jest.clearAllMocks();
  });

  it('triggers the high accuracy request when there is no data and a partial scan', async () => {
    const mockNormalRequestUrl = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [],
        meta: {
          dataScanned: 'partial',
          fields: {},
        },
      },
      method: 'GET',
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.query.sampling === SAMPLING_MODE.NORMAL;
        },
      ],
    });
    const mockHighAccuracyRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.query.sampling === SAMPLING_MODE.HIGH_ACCURACY;
        },
      ],
      method: 'GET',
    });
    renderHookWithProviders(
      () =>
        useExploreSpansTable({
          query: 'test value',
          enabled: true,
          limit: 10,
        }),
      {additionalWrapper: Wrapper}
    );

    expect(mockNormalRequestUrl).toHaveBeenCalledTimes(1);
    expect(mockNormalRequestUrl).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          sampling: SAMPLING_MODE.NORMAL,
          query: 'test value',
        }),
      })
    );

    await waitFor(() => {
      expect(mockHighAccuracyRequest).toHaveBeenCalledTimes(1);
    });
    expect(mockHighAccuracyRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          query: 'test value',
        }),
      })
    );
    expect(mockHighAccuracyRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          sampling: SAMPLING_MODE.HIGH_ACCURACY,
          query: 'test value',
        }),
      })
    );
  });

  it('filters field-only refreshes to the current sample ids', async () => {
    const initialData = [{id: 'aaaaaaaaaaaaaaaa'}, {id: 'bbbbbbbbbbbbbbbb'}];
    const query = 'span.op:http OR span.op:db';
    const expectedQuery =
      '(span.op:http OR span.op:db) id:[aaaaaaaaaaaaaaaa,bbbbbbbbbbbbbbbb]';
    const originalPageLinks = 'original page links';
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: initialData,
        meta: {dataScanned: 'full', fields: {id: 'string'}},
      },
      headers: {Link: originalPageLinks},
      method: 'GET',
      match: [
        function (_url: string, options: Record<string, any>) {
          return !options.query.field.includes('span.custom');
        },
      ],
    });
    const filteredFieldsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: initialData.map(row => ({...row, 'span.custom': 'value'})),
        meta: {
          dataScanned: 'full',
          fields: {id: 'string', 'span.custom': 'string'},
        },
      },
      headers: {Link: 'filtered page links'},
      method: 'GET',
      match: [
        function (_url: string, options: Record<string, any>) {
          return (
            options.query.field.includes('span.custom') &&
            !options.query.field.includes('span.other')
          );
        },
      ],
    });
    const {result} = renderHookWithProviders(() => useTestExploreSpansTable(query), {
      additionalWrapper: Wrapper,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/explore/traces/',
          query: {cursor: '0:100:0'},
        },
      },
    });

    await waitFor(() =>
      expect(result.current.spansTable.result.data).toEqual(initialData)
    );
    const initialRequestIdentityKey = result.current.spansTable.requestIdentityKey;

    act(() => result.current.setFields([...result.current.fields, 'span.custom']));

    await waitFor(() => expect(filteredFieldsRequest).toHaveBeenCalledTimes(1));
    expect(filteredFieldsRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({cursor: '', query: expectedQuery}),
      })
    );
    await waitFor(() =>
      expect(result.current.spansTable.result.data).toEqual(
        initialData.map(row => ({...row, 'span.custom': 'value'}))
      )
    );
    expect(result.current.spansTable.result.pageLinks).toBe(originalPageLinks);
    expect(result.current.spansTable.requestIdentityKey).toBe(initialRequestIdentityKey);
  });

  it('does not reuse a visible-sample lock after the query changes', async () => {
    const initialData = [{id: 'aaaaaaaaaaaaaaaa'}];
    const refreshedData = [{id: 'cccccccccccccccc', 'span.custom': 'fresh value'}];
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: initialData,
        meta: {dataScanned: 'full', fields: {id: 'string'}},
      },
      method: 'GET',
      match: [
        function (_url: string, options: Record<string, any>) {
          return (
            options.query.query === 'span.op:http' &&
            !options.query.field.includes('span.custom')
          );
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [{...initialData[0], 'span.custom': 'value'}],
        meta: {
          dataScanned: 'full',
          fields: {id: 'string', 'span.custom': 'string'},
        },
      },
      method: 'GET',
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.query.query.includes('id:[aaaaaaaaaaaaaaaa]');
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [{id: 'bbbbbbbbbbbbbbbb', 'span.custom': 'other value'}],
        meta: {
          dataScanned: 'full',
          fields: {id: 'string', 'span.custom': 'string'},
        },
      },
      method: 'GET',
      match: [MockApiClient.matchQuery({query: 'span.op:db'})],
    });
    const refreshedOriginalQueryRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: refreshedData,
        meta: {
          dataScanned: 'full',
          fields: {id: 'string', 'span.custom': 'string'},
        },
      },
      method: 'GET',
      match: [
        function (_url: string, options: Record<string, any>) {
          return (
            options.query.query === 'span.op:http' &&
            options.query.field.includes('span.custom')
          );
        },
      ],
    });

    const {result, rerender} = renderHookWithProviders(
      ({query}) => useTestExploreSpansTable(query),
      {
        additionalWrapper: Wrapper,
        initialProps: {query: 'span.op:http'},
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/explore/traces/',
          },
        },
      }
    );

    await waitFor(() =>
      expect(result.current.spansTable.result.data).toEqual(initialData)
    );
    act(() => result.current.setFields([...result.current.fields, 'span.custom']));
    await waitFor(() =>
      expect(result.current.spansTable.result.data).toEqual([
        {...initialData[0], 'span.custom': 'value'},
      ])
    );

    rerender({query: 'span.op:db'});
    await waitFor(() =>
      expect(result.current.spansTable.result.data).toEqual([
        {id: 'bbbbbbbbbbbbbbbb', 'span.custom': 'other value'},
      ])
    );

    rerender({query: 'span.op:http'});
    await waitFor(() => expect(refreshedOriginalQueryRequest).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(result.current.spansTable.result.data).toEqual(refreshedData)
    );
  });

  it('disables extrapolation', async () => {
    const mockNonExtrapolatedRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      match: [
        function (_url: string, options: Record<string, any>) {
          return (
            options.query.sampling === SAMPLING_MODE.HIGH_ACCURACY &&
            options.query.disableAggregateExtrapolation === '1'
          );
        },
      ],
      method: 'GET',
    });

    renderHookWithProviders(
      () =>
        useExploreSpansTable({
          query: 'test value',
          enabled: true,
          limit: 10,
        }),
      {
        additionalWrapper: Wrapper,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/explore/traces/',
            query: {
              extrapolate: '0',
            },
          },
        },
      }
    );

    await waitFor(() => expect(mockNonExtrapolatedRequest).toHaveBeenCalledTimes(1));
    expect(mockNonExtrapolatedRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          disableAggregateExtrapolation: '1',
          sampling: SAMPLING_MODE.HIGH_ACCURACY,
          query: 'test value',
        }),
      })
    );
  });
});
