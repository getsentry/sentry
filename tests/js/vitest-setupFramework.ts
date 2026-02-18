/// <reference types="vitest/globals" />
/* global process */
// eslint-disable-next-line import/no-extraneous-dependencies
import failOnConsole from 'vitest-fail-on-console';

// Mirror Jest's static/app/__mocks__/prismjs.tsx — prevents syntax highlighting
// from splitting code text across <span> elements, which breaks getByText().
// Tests that specifically test Prism tokenization should call vi.unmock('prismjs').
vi.mock('prismjs', async () => {
  const prismComponents =
    await vi.importActual<typeof import('prismjs/components')>('prismjs/components');
  return {
    default: {
      manual: false,
      languages: Object.keys(prismComponents.languages).reduce(
        (acc: Record<string, Record<PropertyKey, unknown>>, language: string) => ({
          ...acc,
          [language]: {},
        }),
        {}
      ),
      tokenize: (code: string) => [code],
      highlightElement: () => {},
    },
  };
});

// Mirror Jest's static/app/__mocks__/react-lazyload.tsx — renders children directly
// so that lazy-loaded components are immediately visible in tests.
// Tests that specifically test lazy loading behavior should call vi.unmock('react-lazyload').
vi.mock('react-lazyload', () => ({
  default: ({children}: {children: React.ReactNode}) => children,
  forceCheck: vi.fn(),
}));

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

    // react-popper updates position asynchronously after a test completes, triggering
    // React's act() warning. The component name in the message varies (e.g., "Hovercard",
    // "Control") because React names the component being updated, not the library source.
    // This fires from third-party react-popper internals and is a known jsdom compat issue.
    if (/An update to .+ inside a test was not wrapped in act/.test(errorMessage)) {
      return true;
    }

    // anchorOffset is a prop passed through styled-components to a DOM node.
    // This is a false positive from third-party library internals, not our code.
    if (
      /React does not recognize the `anchorOffset` prop on a DOM element/.test(
        errorMessage
      )
    ) {
      return true;
    }

    return false;
  },
});
