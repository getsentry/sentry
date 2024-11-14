import {getChunkTimeRange} from './utils';

describe('getChunkTimeRange', () => {
  const start = 1000000000; // Easier to understand timestamp
  const chunkDurationMs = 500000; // Half a minute
  it('should return correct timestamps for the first chunk', () => {
    const chunkIndex = 0;
    expect(getChunkTimeRange(start, chunkIndex, chunkDurationMs)).toEqual([
      1000000000, 1000500001,
    ]);
  });

  it('should return correct timestamps for a chunk in the middle', () => {
    const chunkIndex = 2;
    expect(getChunkTimeRange(start, chunkIndex, chunkDurationMs)).toEqual([
      1001000000, 1001500001,
    ]);
  });

  it('should return correct timestamps for the last chunk', () => {
    const chunkIndex = 10; // Assume 10 chunks total
    expect(getChunkTimeRange(start, chunkIndex, chunkDurationMs)).toEqual([
      1005000000, 1005500001,
    ]);
  });
});
