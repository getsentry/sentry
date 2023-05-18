import {isFilteredRequestErrorEvent} from './initializeSdk';

describe('isFilteredRequestErrorEvent', () => {
  it.each(['GET', 'POST', 'PUT', 'DELETE'])('filters 200 %s events', method => {
    const requestErrorEvent = {
      exception: {
        values: [{type: 'RequestError', value: `${method} /dogs/are/great/ 200`}],
      },
    };

    expect(isFilteredRequestErrorEvent(requestErrorEvent)).toBeTruthy();
  });

  it.each(['GET', 'POST', 'PUT', 'DELETE'])('filters 401 %s events', method => {
    const unauthorizedErrorEvent = {
      exception: {
        values: [{type: 'UnauthorizedError', value: `${method} /dogs/are/great/ 401`}],
      },
    };
    const requestErrorEvent = {
      exception: {
        values: [{type: 'RequestError', value: `${method} /dogs/are/great/ 401`}],
      },
    };

    expect(isFilteredRequestErrorEvent(unauthorizedErrorEvent)).toBeTruthy();
    expect(isFilteredRequestErrorEvent(requestErrorEvent)).toBeTruthy();
  });

  it.each(['GET', 'POST', 'PUT', 'DELETE'])('filters 403 %s events', method => {
    const forbiddenErrorEvent = {
      exception: {
        values: [{type: 'ForbiddenError', value: `${method} /dogs/are/great/ 403`}],
      },
    };
    const requestErrorEvent = {
      exception: {
        values: [{type: 'RequestError', value: `${method} /dogs/are/great/ 403`}],
      },
    };

    expect(isFilteredRequestErrorEvent(forbiddenErrorEvent)).toBeTruthy();
    expect(isFilteredRequestErrorEvent(requestErrorEvent)).toBeTruthy();
  });

  it.each(['GET', 'POST', 'PUT', 'DELETE'])('filters 404 %s events', method => {
    const notFoundErrorEvent = {
      exception: {
        values: [{type: 'NotFoundError', value: `${method} /dogs/are/great/ 404`}],
      },
    };
    const requestErrorEvent = {
      exception: {
        values: [{type: 'RequestError', value: `${method} /dogs/are/great/ 404`}],
      },
    };

    expect(isFilteredRequestErrorEvent(notFoundErrorEvent)).toBeTruthy();
    expect(isFilteredRequestErrorEvent(requestErrorEvent)).toBeTruthy();
  });

  it.each(['NotFoundError', 'ForbiddenError', 'UnauthorizedError'])(
    "doesn't filter other %s events",
    errorType => {
      const event = {
        exception: {
          values: [{type: errorType, value: 'Not enough treats!'}],
        },
      };

      expect(isFilteredRequestErrorEvent(event)).toBeFalsy();
    }
  );
});
