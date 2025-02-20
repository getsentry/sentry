// eslint-disable-next-line no-console
export const originalConsoleWarn = console.warn;

const ignoredWarnings = [
  // React unsafe warnings.
  //
  // XXX(epurkhiser): This should be removed once we no longer have any `UNSAFE_`
  /componentWill.* has been renamed, and is not recommended for use.*/,
  // Moment failures. Why is this happening?
  /moment construction falls back/,
  // Locale not set during tests
  /Locale not set, defaulting to English/,
];

window.console.warn = (message: any, ...args: any[]) => {
  if (
    typeof message === 'string' &&
    ignoredWarnings.some(warning => warning.test(message))
  ) {
    return;
  }

  originalConsoleWarn(message, ...args);
};
