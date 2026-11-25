import {
  barsPerBucketForCount,
  barsPerBucketForWidth,
  groupBars,
} from './annotationBucketSize';

const MINUTE = 60_000;

function bars(firstMinute: number, count: number) {
  return Array.from({length: count}, (_, index) => ({
    start: (firstMinute + index) * MINUTE,
    end: (firstMinute + index + 1) * MINUTE,
  }));
}

describe('barsPerBucketForCount', () => {
  it('spans more bars as the chart has more of them', () => {
    expect([99, 100, 150, 300].map(barsPerBucketForCount)).toEqual([1, 2, 4, 8]);
  });
});

describe('barsPerBucketForWidth', () => {
  it('spans the fewest bars that keep a bucket at least 12px wide, up to 16', () => {
    expect(barsPerBucketForWidth(100, 1200)).toBe(1);
    expect(barsPerBucketForWidth(100, 400)).toBe(4);
    expect(barsPerBucketForWidth(1000, 200)).toBe(16);
  });
});

describe('groupBars', () => {
  it('keeps groups in place when the time range moves, so the buckets on either end can span fewer bars', () => {
    expect(groupBars(bars(3, 8), 4)).toEqual([
      {start: 3 * MINUTE, end: 4 * MINUTE},
      {start: 4 * MINUTE, end: 8 * MINUTE},
      {start: 8 * MINUTE, end: 11 * MINUTE},
    ]);
  });
});
