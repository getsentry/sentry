// eslint-disable-next-line no-console
export const originalConsoleWarn = console.warn;
// eslint-disable-next-line no-console
export const originalConsoleError = console.error;

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

const ignoredErrors = [
  // TODO(react19): We should no longer have these errors before upgrading to React 19 all from AsyncComponent.
  // <ComponentName> uses the legacy contextTypes API which is no longer supported and will be removed in the next major release.
  // Use React.createContext() with static contextType instead.
  /uses the legacy contextTypes API/,
  // TODO(react19): Another error from AsyncComponent.
  // <ComponentName> declares both contextTypes and contextType static properties. The legacy contextTypes property will be ignored.
  /declares both contextTypes and contextType static properties/,
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

window.console.error = (message: any, ...args: any[]) => {
  if (typeof message === 'string' && ignoredErrors.some(error => error.test(message))) {
    return;
  }

  originalConsoleError(message, ...args);
};

export const silencedWarn = window.console.warn;
export const silencedError = window.console.error;
