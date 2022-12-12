import {
  getMemoryInfoKnownDataDetails,
  memoryInfoKnownDataValues,
} from 'sentry/components/events/contexts/memoryInfo/getMemoryInfoKnownDataDetails';

import {memoryInfoMockData} from './index.spec';

describe('getMemoryInfoKnownDataDetails', function () {
  it('returns values and according to the parameters', function () {
    const allKnownData: ReturnType<typeof getMemoryInfoKnownDataDetails>[] = [];

    for (const type of Object.keys(memoryInfoKnownDataValues)) {
      const memoryInfoKnownData = getMemoryInfoKnownDataDetails({
        type: memoryInfoKnownDataValues[type],
        data: memoryInfoMockData,
        event: TestStubs.Event(),
      });

      if (!memoryInfoKnownData) {
        continue;
      }

      allKnownData.push(memoryInfoKnownData);
    }

    expect(allKnownData).toEqual([
      {subject: 'Allocated Bytes', value: 9614872},
      {subject: 'Compacted', value: false},
      {subject: 'Concurrent', value: false},
      {subject: 'Finalization Pending Count', value: 0},
      {subject: 'High Memory Load Threshold Bytes', value: 0},
      {subject: 'Pause Durations', value: [0, 0]},
      {subject: 'Total Available Memory Bytes', value: 34359738368},
    ]);
  });
});
