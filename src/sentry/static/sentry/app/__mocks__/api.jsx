const RealClient = require.requireActual('app/api');

export class Request {}

const respond = (isAsync, fn, ...args) => {
  if (fn) {
    if (isAsync) {
      setTimeout(() => fn(...args), 1);
    } else {
      fn(...args);
    }
  }
};

class Client {
  static mockResponses = [];

  static clearMockResponses() {
    Client.mockResponses = [];
  }

  // Returns a jest mock that represents Client.request calls
  static addMockResponse(response) {
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
    ]);

    return mock;
  }

  static findMockResponse(url, options) {
    return Client.mockResponses.find(([response]) => {
      return url === response.url && (options.method || 'GET') === response.method;
    });
  }

  uniqueId() {
    return '123';
  }

  // In the real client, this clears in-flight responses. It's NOT clearMockResponses. You probably don't want to call this from a test.
  clear() {}

  static mockAsync = false;

  wrapCallback(id, error) {
    return (...args) => {
      if (this.hasProjectBeenRenamed(...args)) return;
      respond(Client.mockAsync, error, ...args);
    };
  }

  requestPromise(path, {includeAllArgs, ...options} = {}) {
    return new Promise((resolve, reject) => {
      this.request(path, {
        ...options,
        success: (data, ...args) => {
          includeAllArgs ? resolve([data, ...args]) : resolve(data);
        },
        error: (error, ...args) => {
          reject(error);
        },
      });
    });
  }

  request(url, options) {
    const [response, mock] = Client.findMockResponse(url, options) || [];

    if (!response) {
      // Endpoints need to be mocked
      throw new Error(
        `No mocked response found for request:\n\t${options.method || 'GET'} ${url}`
      );
    } else {
      // has mocked response

      // mock gets returned when we add a mock response, will represent calls to api.request
      mock(url, options);

      const body =
        typeof response.body === 'function' ? response.body(url, options) : response.body;

      if (response.statusCode !== 200) {
        response.callCount++;
        const resp = {
          status: response.statusCode,
          responseText: JSON.stringify(body),
          responseJSON: body,
        };
        this.handleRequestError(
          {
            path: url,
            requestOptions: options,
          },
          resp
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
}

Client.prototype.handleRequestError = RealClient.Client.prototype.handleRequestError;
Client.prototype.uniqueId = RealClient.Client.prototype.uniqueId;
Client.prototype.bulkUpdate = RealClient.Client.prototype.bulkUpdate;
Client.prototype._chain = RealClient.Client.prototype._chain;
Client.prototype._wrapRequest = RealClient.Client.prototype._wrapRequest;
Client.prototype.hasProjectBeenRenamed =
  RealClient.Client.prototype.hasProjectBeenRenamed;
Client.prototype.merge = RealClient.Client.prototype.merge;

export {Client};
