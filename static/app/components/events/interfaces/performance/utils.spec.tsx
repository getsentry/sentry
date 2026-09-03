import {getSpanCategory, getSpanHash, getSpanSentryGroupValue} from './utils';

describe('getSpanSentryGroupValue', () => {
  it('handles both transaction-derived and segment-derived spans', () => {
    // Segment-derived spans
    expect(
      getSpanSentryGroupValue({
        span_id: '1121201212312012',
        data: {'sentry.group': 'dog_pack'},
      })
    ).toBe('dog_pack');

    // Transaction-derived spans
    expect(
      getSpanSentryGroupValue({
        span_id: '1121201212312012',
        sentry_tags: {group: 'dog_pack'},
      })
    ).toBe('dog_pack');
  });
});

describe('getSpanHash', () => {
  it('handles both transaction-derived and segment-derived spans', () => {
    // Segment-derived spans
    expect(
      getSpanHash({
        span_id: '1121201212312012',
        data: {hash: 'dogs_are_great'},
      })
    ).toBe('dogs_are_great');

    // Transaction-derived spans
    expect(
      getSpanHash({
        span_id: '1121201212312012',
        hash: 'dogs_are_great',
      })
    ).toBe('dogs_are_great');
  });
});

describe('getSpanCategory', () => {
  it('handles both transaction-derived and segment-derived spans', () => {
    // Segment-derived spans
    expect(
      getSpanCategory({
        span_id: '1121201212312012',
        data: {'sentry.category': 'good_dogs'},
      })
    ).toBe('good_dogs');

    // Transaction-derived spans
    expect(
      getSpanCategory({
        span_id: '1121201212312012',
        sentry_tags: {category: 'good_dogs'},
      })
    ).toBe('good_dogs');
  });
});
