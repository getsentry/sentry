import {Fragment} from 'react';
import {http, HttpResponse} from 'msw';

import {server} from 'sentry-test/msw';
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
    beforeEach(() => {
      globalThis.__USE_REAL_API__ = true;
    });
    afterEach(() => {
      globalThis.__USE_REAL_API__ = false;
    });
    it('can do a simple fetch', async () => {
      const resolver = jest.fn(() => {
        return HttpResponse.json(
          {
            value: 5,
          },
          {headers: {'Custom-Header': 'header value'}}
        );
      });

      server.use(http.get('*/some/test/path/', resolver));

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

      expect(resolver).toHaveBeenCalledTimes(1);
      expect(resolver).toHaveBeenCalledWith(
        expect.objectContaining({
          request: expect.objectContaining({
            url: expect.stringContaining('/some/test/path/'),
          }),
        })
      );
    });

    it('can do a fetch with provided query object', async () => {
      const resolver = jest.fn(() => {
        return HttpResponse.json({
          value: 5,
        });
      });
      server.use(http.get('*/some/test/path/', resolver));

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

      expect(resolver).toHaveBeenCalledTimes(1);
      expect(resolver).toHaveBeenCalledWith(
        expect.objectContaining({
          request: expect.objectContaining({
            url: expect.stringContaining('some/test/path/?filter=red'),
          }),
        })
      );
    });

    it('can return error state', async () => {
      server.use(
        http.get('*/some/test/path/', () => {
          return HttpResponse.error();
        })
      );

      function TestComponent() {
        const query = useApiQuery<ResponseData>(['/some/test/path/'], {
          staleTime: 0,
        });

        return query.isError ? <div>something bad happened</div> : null;
      }

      render(<TestComponent />);

      expect(await screen.findByText('something bad happened')).toBeInTheDocument();
    });
  });
});
