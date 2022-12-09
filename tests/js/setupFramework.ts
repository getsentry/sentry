/* global process */
import '@visual-snapshot/jest';

import failOnConsole from 'jest-fail-on-console';

// The `@visual-snapshot/jest` package includes these types, but for some reason
// Google Cloud Build's `tsc` fails to include the types (GHA works as expected).
export {};

declare global {
  namespace jest {
    // eslint complains that R is unused, but we need to match interface,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface Matchers<R> {
      toSnapshot(): CustomMatcherResult;
    }
  }
}

process.on('unhandledRejection', reason => {
  // eslint-disable-next-line no-console
  console.error(reason);
});

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

    // This warning was removed in React 18, can be ignored in most cases
    // https://github.com/reactwg/react-18/discussions/82
    if (
      /Warning: Can't perform a React state update on an unmounted component/.test(
        errorMessage
      )
    ) {
      return true;
    }

    return false;
  },
});
