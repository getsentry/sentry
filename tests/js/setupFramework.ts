/* global process */
import failOnConsole from 'jest-fail-on-console';

// Throw instead of logging console warnings about accessibility issues in react-aria
const reactAriaTextValueWarning =
  /<Item> with non-plain text contents is unsupported by type to select for accessibility\. Please add a `textValue` prop\./;

process.on('unhandledRejection', reason => {
  // eslint-disable-next-line no-console
  console.error(reason);
});

// eslint-disable-next-line no-console
const originalConsoleWarn = console.warn;

// eslint-disable-next-line no-console
console.warn = (message?: unknown, ...args: unknown[]) => {
  if (typeof message === 'string' && reactAriaTextValueWarning.test(message)) {
    throw new Error(message);
  }

  originalConsoleWarn(message, ...args);
};

failOnConsole({
  shouldFailOnWarn: false,
  silenceMessage: errorMessage => {
    // Ignore the following warnings

    if (
      /Warning: componentWill(Mount|ReceiveProps) has been renamed/.test(errorMessage)
    ) {
      return true;
    }

    if (/HTMLMediaElement.prototype.play/.test(errorMessage)) {
      return true;
    }

    return false;
  },
});
