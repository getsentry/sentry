/* global process */
import failOnConsole from 'jest-fail-on-console';

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

    // TODO: Remove this after updating jsdom, currently it cannot handle @container queries
    if (/Error: Could not parse CSS stylesheet/.test(errorMessage)) {
      return true;
    }

    // TODO: Remove after either the removal of AsyncComponent or migrating the tests not to use contexts
    if (
      /uses the legacy contextTypes API which is no longer supported/.test(errorMessage)
    ) {
      return true;
    }

    return false;
  },
});
