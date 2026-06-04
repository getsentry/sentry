import {
  parseEventTimestampMs,
  toEventTimestampMs,
} from 'sentry/utils/date/eventTimestampMs';

describe('parseEventTimestampMs', () => {
  it('parses the non-ISO shape returned by the events endpoint as UTC', () => {
    const date = parseEventTimestampMs('2024-01-02 03:04:05.678');

    expect(date.toISOString()).toBe('2024-01-02T03:04:05.678Z');
    expect(date.getTime()).toBe(Date.UTC(2024, 0, 2, 3, 4, 5, 678));
  });

  it('preserves sub-second precision', () => {
    const date = parseEventTimestampMs('2024-06-15 12:30:45.001');

    expect(date.getUTCMilliseconds()).toBe(1);
  });
});

describe('toEventTimestampMs', () => {
  it('serializes a Date into the non-ISO shape the events endpoint expects', () => {
    const date = new Date(Date.UTC(2024, 0, 2, 3, 4, 5, 678));

    expect(toEventTimestampMs(date)).toBe('2024-01-02 03:04:05.678');
  });

  it('round-trips through parseEventTimestampMs', () => {
    const original = '2024-06-15 12:30:45.001';

    expect(toEventTimestampMs(parseEventTimestampMs(original))).toBe(original);
  });
});
