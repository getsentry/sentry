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

    // Full text:
    // Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release.
    // This is a warning from CellMeasurer in react-virtualized. It safely falls back to something compatible with React 19.
    if (/Accessing element.ref was removed in React 19/.test(errorMessage)) {
      return true;
    }

    return false;
  },
});
