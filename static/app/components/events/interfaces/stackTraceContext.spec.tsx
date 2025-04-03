import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {StackType, StackView} from 'sentry/types/stacktrace';
import localStorageWrapper from 'sentry/utils/localStorage';

import {StacktraceContext, useStacktraceContext} from './stackTraceContext';

describe('StacktraceContext', () => {
  function ContextDisplay() {
    const context = useStacktraceContext();
    return (
      <div>
        <div data-test-id="is-full-stack-trace">{String(context.isFullStackTrace)}</div>
        <div data-test-id="is-newest-frames-first">
          {String(context.isNewestFramesFirst)}
        </div>
        <div data-test-id="stack-view">{context.stackView}</div>
        <div data-test-id="stack-type">{context.stackType}</div>
        {context.displayOptions.length > 0 && (
          <div data-test-id="display-options">
            {JSON.stringify(context.displayOptions)}
          </div>
        )}
      </div>
    );
  }

  function TestButton({
    action,
    children,
  }: {
    action: (context: ReturnType<typeof useStacktraceContext>) => void;
    children: React.ReactNode;
  }) {
    const context = useStacktraceContext();
    return <button onClick={() => action(context)}>{children}</button>;
  }

  beforeEach(() => {
    localStorageWrapper.clear();
  });

  it('provides default values', () => {
    render(
      <StacktraceContext hasSystemFrames={false} projectSlug="test-project">
        <ContextDisplay />
      </StacktraceContext>
    );

    expect(screen.getByTestId('is-full-stack-trace')).toHaveTextContent('false');
    expect(screen.getByTestId('is-newest-frames-first')).toHaveTextContent('true');
    expect(screen.getByTestId('stack-view')).toHaveTextContent(StackView.APP);
    expect(screen.getByTestId('stack-type')).toHaveTextContent(StackType.ORIGINAL);
  });

  it('applies custom props', () => {
    render(
      <StacktraceContext
        hasSystemFrames={false}
        projectSlug="test-project"
        forceFullStackTrace
        defaultIsNewestFramesFirst={false}
      >
        <ContextDisplay />
      </StacktraceContext>
    );

    expect(screen.getByTestId('is-full-stack-trace')).toHaveTextContent('true');
    expect(screen.getByTestId('is-newest-frames-first')).toHaveTextContent('false');
    expect(screen.getByTestId('stack-view')).toHaveTextContent(StackView.FULL);
  });

  it('enables toggling full stack trace', async () => {
    render(
      <StacktraceContext hasSystemFrames={false} projectSlug="test-project">
        <ContextDisplay />
        <TestButton action={ctx => ctx.setIsFullStackTrace(true)}>Show Full</TestButton>
      </StacktraceContext>
    );

    expect(screen.getByTestId('stack-view')).toHaveTextContent(StackView.APP);

    await userEvent.click(screen.getByText('Show Full'));

    expect(screen.getByTestId('is-full-stack-trace')).toHaveTextContent('true');
    expect(screen.getByTestId('stack-view')).toHaveTextContent(StackView.FULL);
  });

  it('sets stack type to minified when option added', async () => {
    render(
      <StacktraceContext hasSystemFrames projectSlug="test-project">
        <ContextDisplay />
        <TestButton action={ctx => ctx.setDisplayOptions(['minified'])}>
          Add Minified
        </TestButton>
      </StacktraceContext>
    );

    expect(screen.getByTestId('stack-type')).toHaveTextContent(StackType.ORIGINAL);

    await userEvent.click(screen.getByText('Add Minified'));

    expect(screen.getByTestId('stack-type')).toHaveTextContent(StackType.MINIFIED);
  });

  it('sets stack view to RAW when option added', async () => {
    render(
      <StacktraceContext hasSystemFrames={false} projectSlug="test-project">
        <ContextDisplay />
        <TestButton action={ctx => ctx.setDisplayOptions(['raw-stack-trace'])}>
          Add Raw View
        </TestButton>
      </StacktraceContext>
    );

    await userEvent.click(screen.getByText('Add Raw View'));

    expect(screen.getByTestId('stack-view')).toHaveTextContent(StackView.RAW);
  });
});
