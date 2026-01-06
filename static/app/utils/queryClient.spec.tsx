import {Fragment} from 'react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

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
      const queryKey: ApiQueryKey = ['/some/test/path/'];
      const result = parseQueryKey(queryKey);
      expect(result).toEqual({
        isInfinite: false,
        url: '/some/test/path/',
        options: undefined,
      });
    });

    it('can parse a simple query key, with options', () => {
      const queryKey: ApiQueryKey = ['/some/test/path/', {query: {filter: 'red'}}];
      const result = parseQueryKey(queryKey);
      expect(result).toEqual({
        isInfinite: false,
        url: '/some/test/path/',
        options: {query: {filter: 'red'}},
      });
    });

    it('can parse an infinite query key, without options', () => {
      const queryKey: InfiniteApiQueryKey = ['infinite', '/some/test/path/'];
      const result = parseQueryKey(queryKey);
      expect(result).toEqual({
        isInfinite: true,
        url: '/some/test/path/',
        options: undefined,
      });
    });

    it('can parse a infinite query key, with options', () => {
      const queryKey: InfiniteApiQueryKey = [
        'infinite',
        '/some/test/path/',
        {query: {filter: 'red'}},
      ];
      const result = parseQueryKey(queryKey);
      expect(result).toEqual({
        isInfinite: true,
        url: '/some/test/path/',
        options: {query: {filter: 'red'}},
      });
    });
  });

  describe('useQuery', () => {
    it('can do a simple fetch', async () => {
      const mock = MockApiClient.addMockResponse({
        url: '/some/test/path/',
        body: {value: 5},
        headers: {'Custom-Header': 'header value'},
      });

      function TestComponent() {
        const {data, getResponseHeader} = useApiQuery<ResponseData>(
          ['/some/test/path/'],
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

      expect(mock).toHaveBeenCalledWith('/some/test/path/', expect.anything());
    });

    it('can do a fetch with provided query object', async () => {
      const mock = MockApiClient.addMockResponse({
        url: '/some/test/path/',
        body: {value: 5},
      });

      function TestComponent() {
        const {data} = useApiQuery<ResponseData>(
          ['/some/test/path/', {query: {filter: 'red'}}],
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
        '/some/test/path/',
        expect.objectContaining({query: {filter: 'red'}})
      );
    });

    it('can return error state', async () => {
      MockApiClient.addMockResponse({
        url: '/some/test/path',
        statusCode: 500,
      });

      function TestComponent() {
        const query = useApiQuery<ResponseData>(['/some/test/path'], {
          staleTime: 0,
        });

        return query.isError ? <div>something bad happened</div> : null;
      }

      render(<TestComponent />);

      expect(await screen.findByText('something bad happened')).toBeInTheDocument();
    });

    it('passes AbortSignal to API client for proper cancellation', async () => {
      const mock = MockApiClient.addMockResponse({
        url: '/some/test/path/',
        body: {value: 5},
      });

      // Track if signal was passed to API client
      const originalRequestPromise = MockApiClient.prototype.requestPromise;
      const requestPromiseSpy = jest.spyOn(
        MockApiClient.prototype,
        'requestPromise'
      );

      function TestComponent({enabled}: {enabled: boolean}) {
        const {data} = useApiQuery<ResponseData>(['/some/test/path/'], {
          staleTime: 0,
          enabled,
        });

        if (!data) {
          return null;
        }

        return <div>{data.value}</div>;
      }

      const {rerender} = render(<TestComponent enabled />);

      // Wait for the query to complete
      expect(await screen.findByText('5')).toBeInTheDocument();

      // Verify that the API client's requestPromise was called with a signal
      expect(requestPromiseSpy).toHaveBeenCalled();
      const callOptions = requestPromiseSpy.mock.calls[0]?.[1];
      expect(callOptions).toHaveProperty('signal');
      expect(callOptions?.signal).toBeInstanceOf(AbortSignal);

      // Cleanup
      requestPromiseSpy.mockRestore();
    });
  });
});
