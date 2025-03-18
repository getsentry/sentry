import {TraceScheduler} from 'sentry/views/performance/newTraceDetails/traceRenderers/traceScheduler';

describe('TraceScheduler', () => {
  it('respects priority', () => {
    const scheduler = new TraceScheduler();

    const highPriority = vi.fn().mockImplementation(() => {
      expect(lowPriority).not.toHaveBeenCalled();
    });
    const lowPriority = vi.fn().mockImplementation(() => {
      expect(highPriority).toHaveBeenCalled();
    });

    // Enquee high priority after low priority
    scheduler.on('draw', lowPriority, 10);
    scheduler.on('draw', highPriority, 1);
    scheduler.dispatch('draw');
  });
  it('once', () => {
    const scheduler = new TraceScheduler();

    const cb = vi.fn();
    scheduler.once('draw', cb);

    scheduler.dispatch('draw');
    scheduler.dispatch('draw');

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('off', () => {
    const scheduler = new TraceScheduler();
    const cb = vi.fn();

    scheduler.on('draw', cb);
    scheduler.off('draw', cb);

    scheduler.dispatch('draw');
    expect(cb).not.toHaveBeenCalled();
  });
});
