import {reasonDescription, reasonTitle} from './outcomes';

describe('reasonTitle', () => {
  it('maps a known reason code to its human title', () => {
    expect(reasonTitle('sample_rate')).toBe('Dropped by sample rate');
    expect(reasonTitle('too_large:span')).toBe('Span payload too large');
  });

  it('maps category-prefixed quota reasons to the quota title', () => {
    expect(reasonTitle('span_usage_exceeded')).toBe('Quota exceeded');
    expect(reasonTitle('log_bytes_usage_exceeded')).toBe('Quota exceeded');
  });

  it('falls back to the raw code for an unknown reason', () => {
    expect(reasonTitle('some_new_reason')).toBe('some_new_reason');
  });
});

describe('reasonDescription', () => {
  it('returns the short description for a known reason', () => {
    expect(reasonDescription('queue_overflow', 'span')).toBe(
      "SDK's send queue was full."
    );
  });

  it('names the data type from the event category', () => {
    expect(reasonDescription('project_abuse_limit', 'log_item')).toBe(
      'Your log events exceeded the project abuse limit.'
    );
    expect(reasonDescription('usage_exceeded', 'trace_metric')).toBe(
      'Your organization hit its quota for the application metric event type.'
    );
  });

  it('describes category-prefixed quota reasons', () => {
    expect(reasonDescription('span_usage_exceeded', 'span')).toBe(
      'Your organization hit its quota for the span event type.'
    );
  });

  it('drops the data type for an unknown category', () => {
    expect(reasonDescription('too_large:event', 'unknown')).toBe(
      'The event exceeded maximum payload size.'
    );
  });

  it('returns undefined for an unknown reason', () => {
    expect(reasonDescription('some_new_reason', 'span')).toBeUndefined();
  });
});
