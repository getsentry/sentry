import {Fragment} from 'react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {useApiQuery} from 'sentry/utils/queryClient';

type ResponseData = {
  value: number;
};

beforeEach(() => {
  jest.restoreAllMocks();
});

describe('queryClient', function () {
  describe('useQuery', function () {
    it('can do a simple fetch', async function () {
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

    it('can do a fetch with provided query object', async function () {
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

    it('can return error state', async function () {
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
  });
});
