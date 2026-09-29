import {AnnotationFixture} from 'sentry-fixture/annotation';
import {ThemeFixture} from 'sentry-fixture/theme';

import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

import {
  groupIntoBuckets,
  hasDroppedData,
  reasonDescription,
  reasonTitle,
  severityColor,
  withAlpha,
} from './utils';

describe('hasDroppedData', () => {
  it('is true when there is at least one dropped annotation', () => {
    expect(hasDroppedData([AnnotationFixture()])).toBe(true);
  });

  it('is false for missing or empty annotations', () => {
    expect(hasDroppedData(undefined)).toBe(false);
    expect(hasDroppedData([])).toBe(false);
  });

  it('is false when every drop is configured', () => {
    expect(
      hasDroppedData([
        AnnotationFixture({outcome: 'client_discard', reason: 'sample_rate'}),
        AnnotationFixture({outcome: 'filtered', reason: 'web-crawlers'}),
      ])
    ).toBe(false);
  });

  it('is true only when a bucket reaches 5%', () => {
    function hasDrops(dropped: number, accepted: number) {
      return hasDroppedData(
        [AnnotationFixture({start: 0, eventCount: dropped})],
        [AnnotationFixture({start: 0, eventCount: accepted})]
      );
    }

    expect(hasDrops(4, 96)).toBe(false);
    expect(hasDrops(5, 95)).toBe(true);
  });
});

describe('groupIntoBuckets', () => {
  it('returns an empty array for no annotations', () => {
    expect(groupIntoBuckets([])).toEqual([]);
  });

  it('collapses annotations sharing a (start, end) and sums eventCount', () => {
    const buckets = groupIntoBuckets([
      AnnotationFixture({
        start: 0,
        end: 60_000,
        eventCount: 10,
        reason: 'rate_limited',
      }),
      AnnotationFixture({start: 0, end: 60_000, eventCount: 5, reason: 'quota'}),
    ]);

    expect(buckets).toHaveLength(1);
    expect(buckets[0]!.dropped.eventCount).toBe(15);
    expect(buckets[0]!.annotations).toHaveLength(2);
    expect(buckets[0]!.start).toBe(0);
    expect(buckets[0]!.end).toBe(60_000);
  });

  it('keeps distinct (start, end) ranges as separate buckets', () => {
    const buckets = groupIntoBuckets([
      AnnotationFixture({start: 0, end: 60_000, eventCount: 10}),
      AnnotationFixture({start: 60_000, end: 120_000, eventCount: 20}),
    ]);

    expect(buckets).toHaveLength(2);
    expect(buckets.map(bucket => bucket.dropped.eventCount)).toEqual([10, 20]);
  });

  it('excludes configured drops', () => {
    const buckets = groupIntoBuckets([
      AnnotationFixture({
        outcome: 'client_discard',
        reason: 'before_send',
        eventCount: 100,
      }),
      AnnotationFixture({
        outcome: 'client_discard',
        reason: 'sample_rate',
        eventCount: 100,
      }),
      AnnotationFixture({
        outcome: 'filtered',
        reason: 'web-crawlers',
        eventCount: 100,
      }),
      AnnotationFixture({
        outcome: 'filtered',
        reason: 'legacy-browsers',
        eventCount: 100,
      }),
      AnnotationFixture({
        outcome: 'filtered',
        reason: 'filtered-transaction',
        eventCount: 100,
      }),
      AnnotationFixture({
        outcome: 'rate_limited',
        reason: 'generic',
        eventCount: 10,
      }),
    ]);

    expect(buckets).toHaveLength(1);
    expect(buckets[0]!.dropped.eventCount).toBe(10);
  });

  it('keeps client discards the SDK did not choose', () => {
    const buckets = groupIntoBuckets([
      AnnotationFixture({
        outcome: 'client_discard',
        reason: 'queue_overflow',
        eventCount: 7,
      }),
      AnnotationFixture({
        outcome: 'client_discard',
        reason: 'network_error',
        eventCount: 3,
      }),
    ]);

    expect(buckets).toHaveLength(1);
    expect(buckets[0]!.dropped.eventCount).toBe(10);
  });

  it('keeps an unrecognized reason under a server-side outcome', () => {
    const buckets = groupIntoBuckets([
      AnnotationFixture({
        outcome: 'invalid',
        reason: 'some_new_reason',
        eventCount: 4,
      }),
    ]);

    expect(buckets[0]!.dropped.eventCount).toBe(4);
  });

  it('subtotals dropped volume by outcome, largest first', () => {
    const buckets = groupIntoBuckets([
      AnnotationFixture({outcome: 'invalid', eventCount: 3}),
      AnnotationFixture({outcome: 'rate_limited', eventCount: 10}),
      AnnotationFixture({outcome: 'invalid', eventCount: 4, reason: 'cors'}),
    ]);

    expect(buckets[0]!.byOutcome).toEqual([
      expect.objectContaining({outcome: 'rate_limited', eventCount: 10}),
      expect.objectContaining({outcome: 'invalid', eventCount: 7}),
    ]);
  });

  it('joins accepted volume by start', () => {
    const buckets = groupIntoBuckets(
      [AnnotationFixture({start: 0, end: 60_000, eventCount: 10})],
      [
        AnnotationFixture({start: 0, end: 60_000, eventCount: 90, outcome: 'accepted'}),
        AnnotationFixture({
          start: 60_000,
          end: 120_000,
          eventCount: 500,
          outcome: 'accepted',
        }),
      ]
    );

    expect(buckets).toHaveLength(1);
    expect(buckets[0]!.accepted.eventCount).toBe(90);
    expect(buckets[0]!.ratio).toBe(0.1);
  });

  it('treats a missing accepted annotation as zero accepted volume', () => {
    const buckets = groupIntoBuckets([
      AnnotationFixture({start: 0, end: 60_000, eventCount: 10}),
    ]);

    expect(buckets[0]!.accepted.eventCount).toBe(0);
    expect(buckets[0]!.ratio).toBe(1);
  });

  it('sums byteSize only for annotations that report it', () => {
    const [withBytes] = groupIntoBuckets(
      [
        AnnotationFixture({start: 0, eventCount: 10, byteSize: 400}),
        AnnotationFixture({start: 0, eventCount: 5, byteSize: 100, reason: 'quota'}),
      ],
      [AnnotationFixture({start: 0, eventCount: 90, byteSize: 9_500})]
    );

    expect(withBytes!.dropped.byteSize).toBe(500);
    expect(withBytes!.accepted.byteSize).toBe(9_500);

    const [withoutBytes] = groupIntoBuckets([
      AnnotationFixture({start: 0, eventCount: 10}),
    ]);

    expect(withoutBytes!.dropped.byteSize).toBeUndefined();
  });
});

describe('severityColor', () => {
  const theme = ThemeFixture();
  const warning = theme.tokens.background.warning.vibrant.toUpperCase();
  const bad = theme.tokens.dataviz.semantic.bad.toUpperCase();
  const orange = '#FF9500';

  it.each([
    [0.049, `${warning}00`],
    [0.05, `${warning}40`],
    [0.1, `${orange}8C`],
    [0.25, `${orange}FF`],
    [0.5, `${bad}FF`],
  ])('colors a drop ratio of %s', (ratio, expected) => {
    expect(severityColor(ratio, theme)).toBe(expected);
  });

  it.each([
    ['light', lightTheme],
    ['dark', darkTheme],
  ])('returns #RRGGBBAA colors in the %s theme', (_, themeVariant) => {
    for (const ratio of [0, 0.05, 0.1, 0.25, 0.5]) {
      expect(severityColor(ratio, themeVariant)).toMatch(/^#[0-9A-F]{8}$/);
    }
  });
});

describe('withAlpha', () => {
  it('appends an alpha channel to a #RRGGBB color', () => {
    expect(withAlpha('#ff9500', 0.5)).toBe('#FF950080');
  });

  it('replaces the alpha channel of a #RRGGBBAA color', () => {
    expect(withAlpha('#FF9500FF', 0)).toBe('#FF950000');
  });
});

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

  it('names the data type from the annotation category', () => {
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
