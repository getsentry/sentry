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

  it('keeps the previous samples while updated fields load', async () => {
    const initialData = [{id: 'aaaaaaaaaaaaaaaa'}];
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: initialData,
        meta: {
          dataScanned: 'full',
          fields: {id: 'string'},
        },
      },
      method: 'GET',
      match: [
        function (_url: string, options: Record<string, any>) {
          return !options.query.field.includes('span.custom');
        },
      ],
    });
    const updatedFieldsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: new Promise(() => {}),
      method: 'GET',
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.query.field.includes('span.custom');
        },
      ],
    });

    const {result} = renderHookWithProviders(() => useTestExploreSpansTable(''), {
      additionalWrapper: Wrapper,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/explore/traces/',
        },
      },
    });

    await waitFor(() =>
      expect(result.current.spansTable.result.data).toEqual(initialData)
    );

    act(() => result.current.setFields([...result.current.fields, 'span.custom']));

    await waitFor(() => expect(updatedFieldsRequest).toHaveBeenCalledTimes(1));
    expect(result.current.spansTable.result.data).toEqual(initialData);
    expect(result.current.spansTable.result.isPlaceholderData).toBe(true);
  });

  it('filters field-only refreshes to the current sample ids', async () => {
    const initialData = [{id: 'aaaaaaaaaaaaaaaa'}, {id: 'bbbbbbbbbbbbbbbb'}];
    const expectedQuery = 'span.op:http id:[aaaaaaaaaaaaaaaa,bbbbbbbbbbbbbbbb]';
    const originalPageLinks =
      '<http://localhost/api/0/organizations/org-slug/events/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1", ' +
      '<http://localhost/api/0/organizations/org-slug/events/?cursor=0:100:0>; rel="next"; results="true"; cursor="0:100:0"';
    const filteredPageLinks =
      '<http://localhost/api/0/organizations/org-slug/events/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1", ' +
      '<http://localhost/api/0/organizations/org-slug/events/?cursor=0:100:0>; rel="next"; results="false"; cursor="0:100:0"';
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
      headers: {Link: filteredPageLinks},
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
    const secondFilteredFieldsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: initialData.map(row => ({
          ...row,
          'span.custom': 'value',
          'span.other': 'other value',
        })),
        meta: {
          dataScanned: 'full',
          fields: {
            id: 'string',
            'span.custom': 'string',
            'span.other': 'string',
          },
        },
      },
      method: 'GET',
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.query.field.includes('span.other');
        },
      ],
    });

    const {result} = renderHookWithProviders(
      () => useTestExploreSpansTable('span.op:http'),
      {
        additionalWrapper: Wrapper,
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

    await waitFor(() => expect(filteredFieldsRequest).toHaveBeenCalledTimes(1));
    expect(filteredFieldsRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({query: expectedQuery}),
      })
    );
    await waitFor(() =>
      expect(result.current.spansTable.result.data).toEqual(
        initialData.map(row => ({...row, 'span.custom': 'value'}))
      )
    );
    expect(result.current.spansTable.result.pageLinks).toBe(originalPageLinks);

    act(() => result.current.setFields([...result.current.fields, 'span.other']));

    await waitFor(() => expect(secondFilteredFieldsRequest).toHaveBeenCalledTimes(1));
    expect(secondFilteredFieldsRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({query: expectedQuery}),
      })
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
