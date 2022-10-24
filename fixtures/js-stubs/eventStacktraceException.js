const {Event} = require('./event');

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
            },
            {
              function: 'doThing',
              module: 'example.application',
              lineNo: 2,
              filename: 'application',
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

module.exports.EventStacktraceException = function (params = {}) {
  return Event({entries: [{...exception}], ...params});
};

module.exports.EventStacktraceMessage = function (params = {}) {
  return Event({entries: [{...message}], ...params});
};
