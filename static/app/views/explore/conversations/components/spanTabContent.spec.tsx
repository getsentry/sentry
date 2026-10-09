import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  EmptySpanTab,
  SpanTabContent,
} from 'sentry/views/explore/conversations/components/spanTabContent';

describe('SpanTabContent', () => {
  const originalResizeObserver = window.ResizeObserver;

  afterEach(() => {
    jest.restoreAllMocks();
    window.ResizeObserver = originalResizeObserver;
  });

  it('renders text content', () => {
    render(<SpanTabContent content="Remember this preference" />);

    expect(screen.getByText('Remember this preference')).toBeInTheDocument();
  });

  it.each([
    {preference: 'concise answers'},
    JSON.stringify({preference: 'concise answers'}),
  ])('renders structured content: %p', content => {
    render(<SpanTabContent content={content} />);

    expect(screen.getByText('preference')).toBeInTheDocument();
    expect(screen.getByText('"concise answers"')).toBeInTheDocument();
  });

  it.each(['A system prompt', {prompt: 'A system prompt'}])(
    'supports optional clipping: %p',
    content => {
      Object.defineProperty(window, 'ResizeObserver', {value: undefined});
      jest.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
        ...document.body.getBoundingClientRect(),
        height: 300,
      });

      const {rerender} = render(<SpanTabContent content={content} clip />);

      expect(screen.getByRole('button', {name: 'Show More'})).toBeInTheDocument();

      rerender(<SpanTabContent content={content} />);

      expect(screen.queryByRole('button', {name: 'Show More'})).not.toBeInTheDocument();
    }
  );
});

describe('EmptySpanTab', () => {
  it('renders the supplied message', () => {
    render(<EmptySpanTab message="No input for this span" />);

    expect(screen.getByText('No input for this span')).toBeInTheDocument();
  });
});
