// eslint-disable-next-line no-console
const originalConsoleError = console.error;

// List of `console.error` messages to fail on
const BAD_ERRORS = [
  'Failed prop type',
  'Failed child context type',
  'Warning: Each child in an array or iterator should have a unique "key" prop',
  'React does not recognize the `[^`]+` prop on a DOM element',
];

// This is needed because when we throw the captured error message, it will
// also `console.error` it
const REPEATED_ERROR = 'Error: Uncaught [Error: Warning: ';

const BAD_ERRORS_REGEX = new RegExp(BAD_ERRORS.join('|'));

// eslint-disable-next-line no-console
console.error = (message, ...args) => {
  if (
    typeof message === 'string' &&
    message.indexOf(REPEATED_ERROR) !== 0 &&
    BAD_ERRORS_REGEX.test(message)
  ) {
    originalConsoleError(message, ...args);
    throw new Error(message);
  } else if (!BAD_ERRORS_REGEX.test(message)) {
    originalConsoleError(message, ...args);
  }
};
