import {findChapterIndex} from './utils';

describe('findChapterIndex', () => {
  const chapters = [
    {start: 1000, end: 2000},
    {start: 2000, end: 3000},
    {start: 3000, end: 4000},
  ];

  it('returns the chapter containing the timestamp', () => {
    expect(findChapterIndex(chapters, 1500)).toBe(0);
    expect(findChapterIndex(chapters, 2500)).toBe(1);
    expect(findChapterIndex(chapters, 3500)).toBe(2);
  });

  it('assigns a shared boundary only to the later chapter', () => {
    expect(findChapterIndex(chapters, 2000)).toBe(1);
    expect(findChapterIndex(chapters, 3000)).toBe(2);
  });

  it('includes the end of the last chapter', () => {
    expect(findChapterIndex(chapters, 4000)).toBe(2);
    expect(findChapterIndex(chapters, 4001)).toBe(-1);
  });

  it('assigns timestamps before the first chapter to the first chapter', () => {
    expect(findChapterIndex(chapters, 1000)).toBe(0);
    expect(findChapterIndex(chapters, 992)).toBe(0);
  });

  it('returns -1 for timestamps in a gap between chapters', () => {
    expect(
      findChapterIndex(
        [
          {start: 1000, end: 2000},
          {start: 3000, end: 4000},
        ],
        2500
      )
    ).toBe(-1);
  });

  it('includes the end of a chapter followed by a gap', () => {
    const gapped = [
      {start: 1000, end: 2000},
      {start: 3000, end: 4000},
    ];
    expect(findChapterIndex(gapped, 2000)).toBe(0);
    expect(findChapterIndex(gapped, 2001)).toBe(-1);
  });

  it('assigns a timestamp to a zero-length chapter at that instant', () => {
    const withZeroLength = [
      {start: 1000, end: 2000},
      {start: 2000, end: 2000},
      {start: 2000, end: 3000},
    ];
    expect(findChapterIndex(withZeroLength, 1999)).toBe(0);
    expect(findChapterIndex(withZeroLength, 2000)).toBe(1);
    expect(findChapterIndex(withZeroLength, 2001)).toBe(2);
  });

  it('handles a single zero-length chapter', () => {
    expect(findChapterIndex([{start: 1000, end: 1000}], 1000)).toBe(0);
    expect(findChapterIndex([{start: 1000, end: 1000}], 1001)).toBe(-1);
  });

  it('assigns overlapping ranges to the earlier chapter', () => {
    const overlapping = [
      {start: 1000, end: 2500},
      {start: 2000, end: 3000},
    ];
    expect(findChapterIndex(overlapping, 2200)).toBe(0);
    expect(findChapterIndex(overlapping, 2500)).toBe(1);
  });

  it('returns -1 when there are no chapters', () => {
    expect(findChapterIndex([], 1000)).toBe(-1);
  });
});
