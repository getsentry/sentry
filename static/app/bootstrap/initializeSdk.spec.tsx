import {ERROR_MAP as origErrorMap} from 'sentry/utils/requestError/requestError';

import {isEventWithFileUrl, isFilteredRequestErrorEvent} from './initializeSdk';

const ERROR_MAP = {
  ...origErrorMap,
  // remove `UndefinedResponseBodyError` since we don't filter those
  200: undefined,
};

describe('isFilteredRequestErrorEvent', () => {
  const methods = ['GET', 'POST', 'PUT', 'DELETE'];
  const stati = [200, 401, 403, 404, 429];

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
