import {Event} from './event';

const exception = {
  type: 'exception',
  data: {
    values: [
      {
        module: 'example.application',
        type: 'Error',
        value: 'an error occurred',
        stacktrace: {
          frames: [
            {
              function: 'main',
              module: 'example.application',
              lineNo: 1,
              filename: 'application',
              inApp: true,
            },
            {
              function: 'doThing',
              module: 'example.application',
              lineNo: 2,
              filename: 'application',
              inApp: true,
            },
          ],
        },
      },
    ],
  },
};

const message = {
  type: 'message',
  data: {
    formatted: 'Something is broken',
  },
};

export function EventStacktraceException(params = {}) {
  return Event({entries: [{...exception}], ...params});
}

export function EventStacktraceMessage(params = {}) {
  return Event({entries: [{...message}], ...params});
}
