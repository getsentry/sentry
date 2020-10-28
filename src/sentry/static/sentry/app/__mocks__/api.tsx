import * as ImportedClient from 'app/api';

const RealClient: typeof ImportedClient = jest.requireActual('app/api');

export class Request {}

const respond = (isAsync: boolean, fn, ...args): void => {
  if (fn) {
    if (isAsync) {
      setTimeout(() => fn(...args), 1);
    } else {
      fn(...args);
    }
  }
};

const DEFAULT_MOCK_RESPONSE_OPTIONS = {
  predicate: () => true,
};

const mergeMock = jest.fn();

type ResponseType = JQueryXHR & {
  url: string;
  statusCode: number;
  method: string;
  callCount: 0;
  body: any;
  headers: {[key: string]: string};
};

class Client {
  static mockResponses: Array<
    [
      ResponseType,
      jest.Mock,
      (url: string, options: Readonly<ImportedClient.RequestOptions>) => boolean
    ]
  > = [];

  static clearMockResponses() {
    Client.mockResponses = [];
  }

  // Returns a jest mock that represents Client.request calls
  static addMockResponse(response, options = DEFAULT_MOCK_RESPONSE_OPTIONS) {
    const mock = jest.fn();
    Client.mockResponses.unshift([
      {
        statusCode: 200,
        body: '',
        method: 'GET',
        callCount: 0,
        ...response,
        headers: response.headers || {},
      },
      mock,
      options.predicate,
    ]);

    return mock;
  }

  static findMockResponse(url: string, options: Readonly<ImportedClient.RequestOptions>) {
    return Client.mockResponses.find(([response, _mock, predicate]) => {
      const matchesURL = url === response.url;
      const matchesMethod = (options.method || 'GET') === response.method;
      const matchesPredicate = predicate(url, options);

      return matchesURL && matchesMethod && matchesPredicate;
    });
  }

  uniqueId() {
    return '123';
  }

  // In the real client, this clears in-flight responses. It's NOT clearMockResponses. You probably don't want to call this from a test.
  clear() {}

  static mockAsync = false;

  wrapCallback(_id, error) {
    return (...args) => {
      // @ts-expect-error
      if (this.hasProjectBeenRenamed(...args)) {
        return;
      }
      respond(Client.mockAsync, error, ...args);
    };
  }

  requestPromise(
    path,
    {
      includeAllArgs,
      ...options
    }: {includeAllArgs?: boolean} & Readonly<ImportedClient.RequestOptions> = {}
  ) {
    return new Promise((resolve, reject) => {
      this.request(path, {
        ...options,
        success: (data, ...args) => {
          includeAllArgs ? resolve([data, ...args]) : resolve(data);
        },
        error: (error, ..._args) => {
          reject(error);
        },
      });
    });
  }

  request(url, options: Readonly<ImportedClient.RequestOptions> = {}) {
    const [response, mock] = Client.findMockResponse(url, options) || [
      undefined,
      undefined,
    ];

    if (!response || !mock) {
      // Endpoints need to be mocked
      const err = new Error(
        `No mocked response found for request:\n\t${options.method || 'GET'} ${url}`
      );

      // Mutate stack to drop frames since test file so that we know where in the test
      // this needs to be mocked
      const lines = err.stack?.split('\n');
      const startIndex = lines?.findIndex(line => line.includes('tests/js/spec'));
      err.stack = ['\n', lines?.[0], ...lines?.slice(startIndex)].join('\n');

      // Throwing an error here does not do what we want it to do....
      // Because we are mocking an API client, we generally catch errors to show
      // user-friendly error messages, this means in tests this error gets gobbled
      // up and developer frustration ensues. Use `setTimeout` to get around this
      setTimeout(() => {
        throw err;
      });
    } else {
      // has mocked response

      // mock gets returned when we add a mock response, will represent calls to api.request
      mock(url, options);

      const body =
        typeof response.body === 'function' ? response.body(url, options) : response.body;

      if (response.statusCode !== 200) {
        response.callCount++;

        const deferred = $.Deferred();

        const errorResponse: JQueryXHR = Object.assign(
          {
            status: response.statusCode,
            responseText: JSON.stringify(body),
            responseJSON: body,
          },
          {
            overrideMimeType: () => {},
            abort: () => {},
            then: () => {},
            error: () => {},
          },
          deferred,
          new XMLHttpRequest()
        );
        this.handleRequestError(
          {
            id: '1234',
            path: url,
            requestOptions: options,
          },
          errorResponse,
          'error',
          'error'
        );
      } else {
        response.callCount++;
        respond(
          Client.mockAsync,
          options.success,
          body,
          {},
          {
            getResponseHeader: key => response.headers[key],
          }
        );
      }
    }

    respond(Client.mockAsync, options.complete);
  }

  hasProjectBeenRenamed = RealClient.Client.prototype.hasProjectBeenRenamed;
  handleRequestError = RealClient.Client.prototype.handleRequestError;
  bulkUpdate = RealClient.Client.prototype.bulkUpdate;
  _chain = RealClient.Client.prototype._chain;
  _wrapRequest = RealClient.Client.prototype._wrapRequest;

  merge(params, options) {
    mergeMock(params, options);

    return RealClient.Client.prototype.merge.call(this, params, options);
  }
}

export {Client, mergeMock};
