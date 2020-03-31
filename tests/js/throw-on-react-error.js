/* global fail */

// eslint-disable-next-line no-console
const originalConsoleError = console.error;

// List of `console.error` messages to ignore
// (i.e. don't fail tests when we get these messages)
const IGNORED_ERRORS = [
  (message, ...args) => message?.includes('Warning: ') && args[0] === 'CreatableSelect',
  message =>
    message?.includes(
      'The pseudo class ":first-child" is potentially unsafe when doing server-side rendering.'
    ),
];

// This is needed because when we throw the captured error message, it will
// also `console.error` it
const REPEATED_ERROR = 'Error: Uncaught [Error: ';

jest.spyOn(console, 'error').mockImplementation((message, ...args) => {
  const isIgnored = IGNORED_ERRORS.some(checkFn => checkFn(message, ...args));

  if (
    typeof message === 'string' &&
    message.indexOf(REPEATED_ERROR) !== 0 &&
    !isIgnored
  ) {
    originalConsoleError(message, ...args);
    const err = new Error('Warnings received from console.error()');
    const lines = err.stack?.split('\n');
    const startIndex = lines?.findIndex(line => line.includes('tests/js/spec'));
    err.stack = ['\n', lines?.[0], ...lines?.slice(startIndex)].join('\n');

    // `fail` is a global from jest/jasmine
    fail(err);
  }
});
