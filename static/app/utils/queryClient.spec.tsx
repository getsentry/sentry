import {Fragment} from 'react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import getApiUrl from 'sentry/utils/api/getApiUrl';
import {
  parseQueryKey,
  useApiQuery,
  type ApiQueryKey,
  type InfiniteApiQueryKey,
} from 'sentry/utils/queryClient';

type ResponseData = {
  value: number;
};

beforeEach(() => {
  jest.restoreAllMocks();
});

describe('queryClient', () => {
  describe('parseQueryKey', () => {
    it('can parse a undefined', () => {
      const result = parseQueryKey(undefined);
      expect(result).toEqual({
        isInfinite: false,
        url: undefined,
        options: undefined,
      });
    });
    it('can parse a simple query key, without options', () => {
      const queryKey: ApiQueryKey = [getApiUrl('/api-tokens/')];
      const result = parseQueryKey(queryKey);
      expect(result).toEqual({
        isInfinite: false,
        url: '/api-tokens/',
        options: undefined,
      });
    });

    it('can parse a simple query key, with options', () => {
      const queryKey: ApiQueryKey = [getApiUrl('/api-tokens/'), {query: {filter: 'red'}}];
      const result = parseQueryKey(queryKey);
      expect(result).toEqual({
        isInfinite: false,
        url: '/api-tokens/',
        options: {query: {filter: 'red'}},
      });
    });

    it('can parse an infinite query key, without options', () => {
      const queryKey: InfiniteApiQueryKey = ['infinite', getApiUrl('/api-tokens/')];
      const result = parseQueryKey(queryKey);
      expect(result).toEqual({
        isInfinite: true,
        url: '/api-tokens/',
        options: undefined,
      });
    });

    it('can parse a infinite query key, with options', () => {
      const queryKey: InfiniteApiQueryKey = [
        'infinite',
        getApiUrl('/api-tokens/'),
        {query: {filter: 'red'}},
      ];
      const result = parseQueryKey(queryKey);
      expect(result).toEqual({
        isInfinite: true,
        url: '/api-tokens/',
        options: {query: {filter: 'red'}},
      });
    });
  });

  describe('useQuery', () => {
    it('can do a simple fetch', async () => {
      const mock = MockApiClient.addMockResponse({
        url: '/api-tokens/',
        body: {value: 5},
        headers: {'Custom-Header': 'header value'},
      });

      function TestComponent() {
        const {data, getResponseHeader} = useApiQuery<ResponseData>(
          [getApiUrl('/api-tokens/')],
          {staleTime: 0}
        );

        if (!data) {
          return null;
        }

        return (
          <Fragment>
            <div>{data.value}</div>
            <div>{getResponseHeader?.('Custom-Header')}</div>
          </Fragment>
        );
      }

      render(<TestComponent />);

      expect(await screen.findByText('5')).toBeInTheDocument();
      expect(screen.getByText('header value')).toBeInTheDocument();

      expect(mock).toHaveBeenCalledWith('/api-tokens/', expect.anything());
    });

    it('can do a fetch with provided query object', async () => {
      const mock = MockApiClient.addMockResponse({
        url: '/api-tokens/',
        body: {value: 5},
      });

      function TestComponent() {
        const {data} = useApiQuery<ResponseData>(
          [getApiUrl('/api-tokens/'), {query: {filter: 'red'}}],
          {staleTime: 0}
        );

        if (!data) {
          return null;
        }

        return <div>{data.value}</div>;
      }

      render(<TestComponent />);

      expect(await screen.findByText('5')).toBeInTheDocument();

      expect(mock).toHaveBeenCalledWith(
        '/api-tokens/',
        expect.objectContaining({query: {filter: 'red'}})
      );
    });

    it('can return error state', async () => {
      MockApiClient.addMockResponse({
        url: '/api-tokens/',
        statusCode: 500,
      });

      function TestComponent() {
        const query = useApiQuery<ResponseData>([getApiUrl('/api-tokens/')], {
          staleTime: 0,
        });

        return query.isError ? <div>something bad happened</div> : null;
      }

      render(<TestComponent />);

      expect(await screen.findByText('something bad happened')).toBeInTheDocument();
    });
  });
});
