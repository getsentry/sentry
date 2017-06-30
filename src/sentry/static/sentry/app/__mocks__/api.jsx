export class Request {}

export class Client {
  static mockResponses = [];

  static clearMockResponses() {
    Client.mockResponses = [];
  }

  static addMockResponse(response) {
    Client.mockResponses.push({
      statusCode: 200,
      body: '',
      method: 'GET',
      ...response
    });
  }

  static findMockResponse(url, options) {
    return Client.mockResponses.find(response => {
      return url === response.url && (options.method || 'GET') === response.method;
    });
  }

  request(url, options) {
    let response = Client.findMockResponse(url, options);
    if (!response) {
      console.error(
        'No mocked response found for request.',
        url,
        options.method || 'GET'
      );
      options.error &&
        options.error({
          status: 404,
          responseText: 'HTTP 404',
          responseJSON: null
        });
    } else if (response.statusCode !== 200) {
      options.error &&
        options.error({
          status: response.statusCode,
          responseText: JSON.stringify(response.body),
          responseJSON: response.body
        });
    } else {
      options.success && options.success(response.body);
    }
    options.complete && options.complete();
  }
}
