import {HistogramData} from 'sentry/utils/performance/histogram/types';
import {matchBinSize} from 'sentry/utils/performance/histogram/utils';

let data1: HistogramData;
let data2: HistogramData;

describe('matchBinSize()', () => {
  beforeEach(() => {
    data1 = [
      {bin: 2, count: 2},
      {bin: 4, count: 4},
      {bin: 6, count: 6},
      {bin: 8, count: 4},
      {bin: 10, count: 2},
    ];
    data2 = [
      {bin: 5, count: 5},
      {bin: 10, count: 5},
      {bin: 15, count: 5},
      {bin: 20, count: 5},
    ];
  });

  describe('When data1.bin < data2.bin', () => {
    it('should match bin size', () => {
      const [updatedData1] = matchBinSize(data1, data2);
      updatedData1.forEach(({bin}, idx) => {
        expect(bin).toBe(data2[idx].bin);
      });
    });

    it('should have correct number count', () => {
      const [updatedData1] = matchBinSize(data1, data2);
      expect(updatedData1[0].count).toBe(6);
      expect(updatedData1[1].count).toBe(12);
    });
  });

  describe('When data1.bin > data2.bin', () => {
    it('should match bin size', () => {
      const [_, updatedData1] = matchBinSize(data2, data1);
      updatedData1.forEach(({bin}, idx) => {
        expect(bin).toBe(data2[idx].bin);
      });
    });

    it('should have correct number count', () => {
      const [_, updatedData1] = matchBinSize(data2, data1);
      expect(updatedData1[0].count).toBe(6);
      expect(updatedData1[1].count).toBe(12);
    });
  });

  describe('when a bin is empty', () => {
    it('should skip the bin', () => {
      data1[0].count = 0;
      data1[1].count = 0;
      const [updatedData1] = matchBinSize(data1, data2);
      expect(updatedData1[0].bin).toBe(10);
    });
  });
});
