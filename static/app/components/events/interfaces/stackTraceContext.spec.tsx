import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StackType, StackView} from 'sentry/types/stacktrace';
import * as useLocalStorageStateModule from 'sentry/utils/useLocalStorageState';

import {StacktraceContext, useStacktraceContext} from './stackTraceContext';

describe('StacktraceContext', () => {
  function TestComponent() {
    const context = useStacktraceContext();
    return (
      <div>
        <div data-test-id="is-full-stack-trace">{String(context.isFullStackTrace)}</div>
        <div data-test-id="is-newest-frames-first">
          {String(context.isNewestFramesFirst)}
        </div>
        <div data-test-id="stack-view">{context.stackView}</div>
        <div data-test-id="stack-type">{context.stackType}</div>
        <div data-test-id="display-options">{JSON.stringify(context.displayOptions)}</div>
      </div>
    );
  }

  beforeEach(() => {
    // Default mock that returns empty display options
    jest
      .spyOn(useLocalStorageStateModule, 'useLocalStorageState')
      .mockImplementation(() => [[], jest.fn()]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders with default values', () => {
    render(
      <StacktraceContext hasSystemFrames={false} projectSlug="test-project">
        <TestComponent />
      </StacktraceContext>
    );

    expect(screen.getByTestId('is-full-stack-trace')).toHaveTextContent('false');
    expect(screen.getByTestId('is-newest-frames-first')).toHaveTextContent('true');
    expect(screen.getByTestId('stack-view')).toHaveTextContent(StackView.APP);
    expect(screen.getByTestId('stack-type')).toHaveTextContent(StackType.ORIGINAL);
    expect(screen.getByTestId('display-options')).toHaveTextContent('[]');
  });

  it('uses provided default values', () => {
    render(
      <StacktraceContext
        hasSystemFrames={false}
        projectSlug="test-project"
        forceFullStackTrace
        defaultIsNewestFramesFirst={false}
      >
        <TestComponent />
      </StacktraceContext>
    );

    expect(screen.getByTestId('is-full-stack-trace')).toHaveTextContent('true');
    expect(screen.getByTestId('is-newest-frames-first')).toHaveTextContent('false');
    expect(screen.getByTestId('stack-view')).toHaveTextContent(StackView.FULL);
  });

  it('sets stack type to minified when hasSystemFrames is true and display option includes minified', () => {
    // Mock with minified display option
    jest
      .spyOn(useLocalStorageStateModule, 'useLocalStorageState')
      .mockImplementation(() => [['minified'], jest.fn()]);

    render(
      <StacktraceContext hasSystemFrames projectSlug="test-project">
        <TestComponent />
      </StacktraceContext>
    );

    expect(screen.getByTestId('stack-type')).toHaveTextContent(StackType.MINIFIED);
  });

  it('sets stack view to RAW when display options includes raw-stack-trace', () => {
    // Mock with raw-stack-trace display option
    jest
      .spyOn(useLocalStorageStateModule, 'useLocalStorageState')
      .mockImplementation(() => [['raw-stack-trace'], jest.fn()]);

    render(
      <StacktraceContext hasSystemFrames={false} projectSlug="test-project">
        <TestComponent />
      </StacktraceContext>
    );

    expect(screen.getByTestId('stack-view')).toHaveTextContent(StackView.RAW);
  });
});
