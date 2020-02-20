// eslint-disable-next-line no-console
const originalConsoleWarn = console.warn;

const REACT_UNSAFE_WARNING_REGEX = /componentWill.* has been renamed, and is not recommended for use.*/;

window.console.warn = (message, ...args) => {
  if (typeof message === 'string' && REACT_UNSAFE_WARNING_REGEX.test(message)) {
    return;
  }

  originalConsoleWarn(message, ...args);
};
