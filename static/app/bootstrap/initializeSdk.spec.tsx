import * as Sentry from '@sentry/react';

import {ERROR_MAP as origErrorMap} from 'sentry/utils/requestError/requestError';

import {
  addEndpointTagToRequestError,
  initializeSdk,
  isEventWithFileUrl,
  isFilteredRequestErrorEvent,
} from './initializeSdk';

const ERROR_MAP = {
  ...origErrorMap,
  // remove `UndefinedResponseBodyError` since we don't filter those
  200: undefined,
};

describe('initializeSdk', () => {
  beforeAll(() => {
    window.__initialData = {
      ...window.__initialData,
      customerDomain: null,
    };
  });

  // This is a regression test for Sentry incident inc-433
  // We need to make sure that /^\// is included in the list of tracePropagationTargets
  // so that we can have frontend to backend tracing.
  it('enables distributed tracing to sentry api endpoint', () => {
    initializeSdk({
      ...window.__initialData,
      apmSampling: 1,
      sentryConfig: {
        allowUrls: [],
        dsn: '',
        release: '',
        tracePropagationTargets: ['other', 'stuff'],
      },
    });

    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        tracePropagationTargets: expect.arrayContaining([/^\//]),
      })
    );
  });
});

describe('isFilteredRequestErrorEvent', () => {
  const methods = ['GET', 'POST', 'PUT', 'DELETE'];
  const stati = [200, 400, 401, 403, 404, 429];

  describe('matching error type, matching message', () => {
    for (const method of methods) {
      describe(`${method} requests`, () => {
        for (const status of stati) {
          // We have to filter out falsy values here because 200 isn't in `ERROR_MAP`
          // and will never appear with any other error name besides `RequestError`
          for (const errorName of ['RequestError', ERROR_MAP[status]].filter(Boolean)) {
            describe('main error', () => {
              it(`recognizes ${status} ${method} events of type ${errorName}`, () => {
                const event = {
                  exception: {
                    values: [
                      {type: errorName, value: `${method} /dogs/are/great/ ${status}`},
                    ],
                  },
                };

                expect(isFilteredRequestErrorEvent(event)).toBeTruthy();
              });
            });

            describe('cause error', () => {
              it(`recognizes ${status} ${method} events of type ${errorName} as causes`, () => {
                const event = {
                  exception: {
                    values: [
                      {type: errorName, value: `${method} /dogs/are/great/ ${status}`},
                      {type: 'InsufficientTreatsError', value: 'Not enough treats!'},
                    ],
                  },
                };

                expect(isFilteredRequestErrorEvent(event)).toBeTruthy();
              });
            });
          }
        }
      });
    }
  });

  describe('matching error type, non-matching message', () => {
    for (const status of stati) {
      // We have to filter out falsy values here because 200 isn't in `ERROR_MAP`
      // and will never appear with any other error name besides `RequestError`
      for (const errorName of ['RequestError', ERROR_MAP[status]].filter(Boolean)) {
        describe('main error', () => {
          it(`rejects other errors of type ${errorName}`, () => {
            const event = {
              exception: {
                values: [
                  {type: errorName, value: "Failed to fetch requested object: 'ball'"},
                ],
              },
            };

            expect(isFilteredRequestErrorEvent(event)).toBeFalsy();
          });
        });

        describe('cause error', () => {
          it(`rejects other errors of type ${errorName} as causes`, () => {
            const event = {
              exception: {
                values: [
                  {type: errorName, value: "Failed to fetch requested object: 'ball'"},
                  {type: 'InsufficientTreatsError', value: 'Not enough treats!'},
                ],
              },
            };

            expect(isFilteredRequestErrorEvent(event)).toBeFalsy();
          });
        });
      }
    }
  });

  describe('non-matching error type, non-matching message', () => {
    it(`rejects other errors`, () => {
      const event = {
        exception: {
          values: [{type: 'UncaughtSquirrelError', value: 'Squirrel was not caught'}],
        },
      };

      expect(isFilteredRequestErrorEvent(event)).toBeFalsy();
    });

    it(`rejects other errors as causes`, () => {
      const event = {
        exception: {
          values: [
            {type: 'UncaughtSquirrelError', value: 'Squirrel was not caught'},
            {type: 'InsufficientTreatsError', value: 'Not enough treats!'},
          ],
        },
      };

      expect(isFilteredRequestErrorEvent(event)).toBeFalsy();
    });
  });
});

describe('isEventWithFileUrl', () => {
  it('recognizes events with `file://` urls', () => {
    const event = {request: {url: 'file://dogs/are/great.html'}};

    expect(isEventWithFileUrl(event)).toBeTruthy();
  });

  it('rejects events with other urls', () => {
    const event = {request: {url: 'http://dogs.are.great'}};

    expect(isEventWithFileUrl(event)).toBeFalsy();
  });

  it('rejects events without urls', () => {
    const event = {};

    expect(isEventWithFileUrl(event)).toBeFalsy();
  });
});

describe('addEndpointTagToRequestError', () => {
  it('adds `endpoint` tag to events with matching message`', () => {
    const event = {
      exception: {
        values: [{type: 'RequestError', value: 'GET /dogs/are/great/ 500'}],
      },
      tags: {},
    };

    addEndpointTagToRequestError(event);

    expect(event.tags).toEqual({
      endpoint: 'GET /dogs/are/great/',
    });
  });

  it("doesn't add `endpoint` tag to events with non-matching message", () => {
    const nonmatchingMessages = [
      'RequestError with no endpoint for some reason',
      'Some other stuff is wrong with endpoint /dogs/are/great/',
      'This error has nothing to do with requests or endpoints at all',
    ];

    for (const msg of nonmatchingMessages) {
      const event = {
        exception: {
          values: [{type: 'RequestError', value: msg}],
        },
        tags: {},
      };

      addEndpointTagToRequestError(event);

      expect(event.tags).toEqual({});
    }
  });

  it("doesn't add `endpoint` tag to events with no exception", () => {
    const event = {
      tags: {},
    };

    addEndpointTagToRequestError(event);

    expect(event.tags).toEqual({});
  });
});
