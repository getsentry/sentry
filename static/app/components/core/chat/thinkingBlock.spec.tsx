import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ThinkingBlock} from '@sentry/scraps/chat';

describe('ThinkingBlock', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('counts up until endTime is provided', () => {
    const start = new Date('2025-01-01T00:00:00Z');
    jest.setSystemTime(new Date('2025-01-01T00:00:05.300Z'));

    const {rerender} = render(
      <ThinkingBlock title="Analyzing..." startTime={start}>
        <div>content</div>
      </ThinkingBlock>
    );

    expect(screen.getByText('5.3s')).toBeInTheDocument();

    act(() => jest.advanceTimersByTime(2000));
    expect(screen.getByText('7.3s')).toBeInTheDocument();

    const end = new Date('2025-01-01T00:00:10.000Z');
    rerender(
      <ThinkingBlock title="Analyzing..." startTime={start} endTime={end}>
        <div>content</div>
      </ThinkingBlock>
    );

    expect(screen.getByText('10.0s')).toBeInTheDocument();

    act(() => jest.advanceTimersByTime(5000));
    expect(screen.getByText('10.0s')).toBeInTheDocument();
  });

  it('is expanded by default and collapses when endTime arrives', () => {
    jest.useRealTimers();
    const start = new Date();

    const {rerender} = render(
      <ThinkingBlock title="Thinking..." startTime={start}>
        <div>inner content</div>
      </ThinkingBlock>
    );

    expect(screen.getByText('inner content')).toBeVisible();

    rerender(
      <ThinkingBlock title="Thinking..." startTime={start} endTime={new Date()}>
        <div>inner content</div>
      </ThinkingBlock>
    );

    expect(screen.getByText('inner content')).not.toBeVisible();
  });

  it('can be manually collapsed while thinking is active', async () => {
    jest.useRealTimers();
    const start = new Date();

    render(
      <ThinkingBlock title="Thinking" startTime={start}>
        <div>inner content</div>
      </ThinkingBlock>
    );

    expect(screen.getByText('inner content')).toBeVisible();

    await userEvent.click(screen.getByText('Thinking'));
    expect(screen.getByText('inner content')).not.toBeVisible();
  });

  it('auto-collapses when thinking completes even if user re-expanded', async () => {
    jest.useRealTimers();
    const start = new Date();

    const {rerender} = render(
      <ThinkingBlock title="Thinking" startTime={start}>
        <div>inner content</div>
      </ThinkingBlock>
    );

    // collapse then re-expand while still active
    await userEvent.click(screen.getByText('Thinking'));
    expect(screen.getByText('inner content')).not.toBeVisible();
    await userEvent.click(screen.getByText('Thinking'));
    expect(screen.getByText('inner content')).toBeVisible();

    // thinking completes → auto-collapse
    rerender(
      <ThinkingBlock title="Thinking" startTime={start} endTime={new Date()}>
        <div>inner content</div>
      </ThinkingBlock>
    );

    expect(screen.getByText('inner content')).not.toBeVisible();
  });

  it('can be manually toggled after collapsing', async () => {
    jest.useRealTimers();
    const start = new Date();
    const end = new Date();

    render(
      <ThinkingBlock title="Done" startTime={start} endTime={end}>
        <div>inner content</div>
      </ThinkingBlock>
    );

    expect(screen.getByText('inner content')).not.toBeVisible();

    await userEvent.click(screen.getByText('See thinking and tool calls'));
    expect(screen.getByText('inner content')).toBeVisible();
  });

  it('shows summary title when completed instead of the last streamed title', () => {
    jest.useRealTimers();
    const start = new Date();

    const {rerender} = render(
      <ThinkingBlock title="Querying spans..." startTime={start}>
        <div>content</div>
      </ThinkingBlock>
    );

    expect(screen.getByText('Querying spans')).toBeInTheDocument();
    expect(screen.queryByText('See thinking and tool calls')).not.toBeInTheDocument();

    rerender(
      <ThinkingBlock title="Querying spans..." startTime={start} endTime={new Date()}>
        <div>content</div>
      </ThinkingBlock>
    );

    expect(screen.getByText('See thinking and tool calls')).toBeInTheDocument();
    expect(screen.queryByText('Querying spans')).not.toBeInTheDocument();
  });

  it('formats minutes for long durations', () => {
    const start = new Date('2025-01-01T00:00:00Z');
    const end = new Date('2025-01-01T00:01:30.000Z');

    render(
      <ThinkingBlock title="Done" startTime={start} endTime={end}>
        <div>content</div>
      </ThinkingBlock>
    );

    expect(screen.getByText('1.5min')).toBeInTheDocument();
  });
});
