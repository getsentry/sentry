// eslint-disable-next-line no-console
export const originalConsoleWarn = console.warn;

const REACT_UNSAFE_WARNING_REGEX =
  /componentWill.* has been renamed, and is not recommended for use.*/;
const MOMENT_INVALID_INPUT_REGEX = /moment construction falls back/;

window.console.warn = (message: any, ...args: any[]) => {
  if (
    typeof message === 'string' &&
    (REACT_UNSAFE_WARNING_REGEX.test(message) || MOMENT_INVALID_INPUT_REGEX.test(message))
  ) {
    return;
  }

  originalConsoleWarn(message, ...args);
};

export const silencedWarn = window.console.warn;
