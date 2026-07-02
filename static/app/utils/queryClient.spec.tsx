import {Fragment} from 'react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {DEFAULT_QUERY_CLIENT_CONFIG, useApiQuery} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';

type ResponseData = {
  value: number;
};

beforeEach(() => {
  jest.restoreAllMocks();
});

describe('queryClient', () => {
  describe('useQuery', () => {
    it('can do a simple fetch', async () => {
      const mock = MockApiClient.addMockResponse({
        url: '/api-tokens/',
        body: {value: 5},
      });

      function TestComponent() {
        const {data} = useApiQuery<ResponseData>([getApiUrl('/api-tokens/')], {
          staleTime: 0,
        });

        if (!data) {
          return null;
        }

        return (
          <Fragment>
            <div>{data.value}</div>
          </Fragment>
        );
      }

      render(<TestComponent />);

      expect(await screen.findByText('5')).toBeInTheDocument();

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

  describe('default retry', () => {
    const retry = DEFAULT_QUERY_CLIENT_CONFIG.defaultOptions?.queries?.retry as (
      failureCount: number,
      error: Error
    ) => boolean;

    const errorWithStatus = (status: number) => {
      const err = new RequestError('GET', '/x/', new Error('request failed'));
      err.status = status;
      return err;
    };

    it.each([400, 401, 403, 404])('does not retry on %s status', status => {
      expect(retry(0, errorWithStatus(status))).toBe(false);
    });

    it.each([
      [0, true],
      [2, true],
      [3, false],
    ])('retries other errors when failureCount is %i', (failureCount, expected) => {
      expect(retry(failureCount, errorWithStatus(500))).toBe(expected);
    });
  });
});
