import {render, screen} from 'sentry-test/reactTestingLibrary';

import {useQuery} from 'sentry/utils/queryClient';
import RequestError from 'sentry/utils/requestError/requestError';
import * as useApi from 'sentry/utils/useApi';

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
      });

      const TestComponent = () => {
        const {data} = useQuery<ResponseData>(['/some/test/path/']);

        if (!data) {
          return null;
        }

        return <div>{data.value}</div>;
      };

      render(<TestComponent />);

      expect(await screen.findByText('5')).toBeInTheDocument();

      expect(mock).toHaveBeenCalledWith('/some/test/path/', expect.anything());
    });

    it('can do a fetch with provided query object', async function () {
      const mock = MockApiClient.addMockResponse({
        url: '/some/test/path/',
        body: {value: 5},
      });

      const TestComponent = () => {
        const {data} = useQuery<ResponseData>([
          '/some/test/path/',
          {query: {filter: 'red'}},
        ]);

        if (!data) {
          return null;
        }

        return <div>{data.value}</div>;
      };

      render(<TestComponent />);

      expect(await screen.findByText('5')).toBeInTheDocument();

      expect(mock).toHaveBeenCalledWith(
        '/some/test/path/',
        expect.objectContaining({query: {filter: 'red'}})
      );
    });

    it('can fetch with custom query function', async function () {
      const TestComponent = () => {
        const {data} = useQuery<ResponseData>(['some-key'], () => ({value: 5}));

        if (!data) {
          return null;
        }

        return <div>{data.value}</div>;
      };

      render(<TestComponent />);

      expect(await screen.findByText('5')).toBeInTheDocument();
    });

    it('can return error state', async function () {
      const requestError = new RequestError('GET', '/some/test/path', {
        cause: new Error(),
      });
      requestError.setMessage('something bad happened');

      const api = new MockApiClient();
      jest.spyOn(useApi, 'default').mockReturnValue(api);
      jest.spyOn(api, 'requestPromise').mockRejectedValue(requestError);

      const TestComponent = () => {
        const {isError, error} = useQuery<ResponseData>(['/some/test/path']);

        if (!isError) {
          return null;
        }

        return <div>{error.message}</div>;
      };

      render(<TestComponent />);

      expect(await screen.findByText('something bad happened')).toBeInTheDocument();
    });
  });
});
