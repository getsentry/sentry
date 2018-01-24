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
    let mock = jest.fn();
    Client.mockResponses.push([
      {
        statusCode: 200,
        body: '',
        method: 'GET',
        callCount: 0,
        ...response,
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

  clear() {}

  static mockAsync = false;

  merge(params, options) {
    let path = '/projects/' + params.orgId + '/' + params.projectId + '/issues/';
    return this.request(path, {
      method: 'PUT',
      data: {merge: 1},
      ...options,
    });
  }

  wrapCallback(id, error) {
    return (...args) => respond(Client.mockAsync, error, ...args);
  }

  requestPromise(url, options) {
    return new Promise((resolve, reject) =>
      this.request(url, {
        ...options,
        success: resolve,
        error: reject,
      })
    );
  }

  request(url, options) {
    let [response, mock] = Client.findMockResponse(url, options) || [];

    if (!response) {
      // eslint-disable-next-line no-console
      console.error(
        'No mocked response found for request.',
        url,
        options.method || 'GET'
      );
      let resp = {
        status: 404,
        responseText: 'HTTP 404',
        responseJSON: null,
      };
      respond(Client.mockAsync, options.error, resp);
    } else {
      // has mocked response

      // mock gets returned when we add a mock response, will represent calls to api.request
      mock(url, options);
      if (response.statusCode !== 200) {
        response.callCount++;
        let resp = {
          status: response.statusCode,
          responseText: JSON.stringify(response.body),
          responseJSON: response.body,
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
          response.body,
          {},
          {getResponseHeader: () => {}}
        );
      }
    }

    respond(Client.mockAsync, options.complete);
  }
}

Client.prototype.handleRequestError = RealClient.Client.prototype.handleRequestError;

export {Client};
