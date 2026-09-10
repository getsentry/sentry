import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ToolCall} from '@sentry/scraps/chat';

// `ClippedBox` measures content via `ResizeObserver`; this mock reports a fixed height
// synchronously (as the real observer would on first layout) so a clip decision is available
// immediately, without waiting on a real browser layout pass.
function mockContentHeight(height: number) {
  const previous = window.ResizeObserver;

  class MockResizeObserver {
    callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe(element: Element) {
      this.callback(
        [
          {
            target: element,
            // @ts-expect-error partial mock: only `blockSize` is read.
            contentBoxSize: [{blockSize: height}],
          },
        ],
        this
      );
    }
    unobserve() {}
    disconnect() {}
  }

  window.ResizeObserver = MockResizeObserver;
  return () => {
    window.ResizeObserver = previous;
  };
}

describe('ToolCall', () => {
  it('renders a title plus a trailing reference, no output', () => {
    render(
      <ToolCall
        title="Read trace waterfall"
        status="success"
        reference={{label: 'Trace', value: 'a3805648'}}
      />
    );

    expect(screen.getByText('Read trace waterfall')).toBeInTheDocument();
    expect(screen.getByText('a3805648')).toBeInTheDocument();
    expect(screen.queryByText('Output:')).not.toBeInTheDocument();
  });

  it('renders an output slot under an Output label', () => {
    render(
      <ToolCall
        title="Query spans"
        status="failure"
        output={<span>Returned HTTP 502</span>}
      />
    );

    expect(screen.getByText('Query spans')).toBeInTheDocument();
    expect(screen.getByText('Output:')).toBeInTheDocument();
    expect(screen.getByText('Returned HTTP 502')).toBeInTheDocument();
  });

  it('communicates status via the leading glyph', () => {
    const {rerender} = render(<ToolCall title="Query" status="success" />);
    expect(screen.getByLabelText('Succeeded')).toBeInTheDocument();

    rerender(<ToolCall title="Query" status="failure" />);
    expect(screen.getByLabelText('Failed')).toBeInTheDocument();

    rerender(<ToolCall title="Query" status="loading" />);
    expect(screen.getByLabelText('Running')).toBeInTheDocument();
  });

  it('keeps the leading glyph and hoists a Failed chip beside the result on failure', () => {
    render(<ToolCall title="Query spans" status="failure" />);

    // Leading glyph (accessible label) plus a visible trailing chip.
    expect(screen.getByLabelText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('shows the failureLabel (e.g. HTTP status) in the trailing chip', () => {
    render(<ToolCall title="Query spans" status="failure" failureLabel="502" />);

    expect(screen.getByText('502')).toBeInTheDocument();
    expect(screen.queryByText('Failed')).not.toBeInTheDocument();
  });

  it('renders the input slot under an Input label', () => {
    render(
      <ToolCall
        title="Query spans"
        status="success"
        input={<span>dataset is spans</span>}
      />
    );

    expect(screen.getByText('Input:')).toBeInTheDocument();
    expect(screen.getByText('dataset is spans')).toBeInTheDocument();
  });

  it('surfaces notifications', () => {
    render(
      <ToolCall
        title="Query spans"
        status="success"
        notifications={['Truncated to 100 rows']}
      />
    );
    expect(screen.getByText('Truncated to 100 rows')).toBeInTheDocument();
  });

  it('renders a reference with a `to` as a real link', () => {
    render(
      <ToolCall
        title="Read trace waterfall"
        status="success"
        reference={{label: 'Trace', value: 'a3805648', to: '/traces/a3805648/'}}
      />
    );

    // LinkButton renders an anchor (href, middle/cmd-click) with role="button".
    expect(screen.getByRole('button', {name: /a3805648/})).toHaveAttribute(
      'href',
      '/traces/a3805648/'
    );
  });

  it('does not clip short output, and shows no expand affordance', () => {
    const restore = mockContentHeight(20);
    render(
      <ToolCall title="Query spans" status="success" output={<span>12 rows</span>} />
    );

    expect(screen.getByText('12 rows')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Show More'})).not.toBeInTheDocument();
    restore();
  });

  it('clips output taller than the cap behind a click-to-expand affordance', async () => {
    const restore = mockContentHeight(500);
    render(
      <ToolCall
        title="Query spans"
        status="success"
        output={<span>{'{"very": "long json body"}'}</span>}
      />
    );

    const expandButton = screen.getByRole('button', {name: 'Show More'});
    expect(expandButton).toBeInTheDocument();
    // The content itself still renders (it is clipped via `max-height`, not removed).
    expect(screen.getByText('{"very": "long json body"}')).toBeInTheDocument();

    await userEvent.click(expandButton);
    expect(screen.queryByRole('button', {name: 'Show More'})).not.toBeInTheDocument();
    restore();
  });

  it('clips a tall input the same way as output', () => {
    const restore = mockContentHeight(500);
    render(
      <ToolCall
        title="Query spans"
        status="success"
        input={<span>dataset is spans</span>}
      />
    );

    expect(screen.getByRole('button', {name: 'Show More'})).toBeInTheDocument();
    restore();
  });

  it('renders supplementary detail children inline, always visible', () => {
    render(
      <ToolCall title="Query spans" status="success">
        <div>GET /api/0/traces/a3805648/</div>
      </ToolCall>
    );

    // A tool call is not a disclosure: its detail is not tucked behind a toggle.
    expect(screen.getByText('GET /api/0/traces/a3805648/')).toBeVisible();
    expect(screen.queryByRole('button', {name: /Query spans/})).not.toBeInTheDocument();
  });
});
