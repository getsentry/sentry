import {Event as EventFixture} from 'sentry-fixture/event';

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
        event: EventFixture(),
      });

      if (!memoryInfoKnownData) {
        continue;
      }

      allKnownData.push(memoryInfoKnownData);
    }

    expect(allKnownData).toEqual([
      {subject: 'Allocated Bytes', value: 9614872},
      {subject: 'Fragmented Bytes', value: undefined},
      {subject: 'Heap Size Bytes', value: undefined},
      {subject: 'High Memory Load Threshold Bytes', value: 30923764531},
      {subject: 'Total Available Memory Bytes', value: 34359738368},
      {subject: 'Memory Load Bytes', value: undefined},
      {subject: 'Total Committed Bytes', value: undefined},
      {subject: 'Promoted Bytes', value: undefined},
      {subject: 'Pinned Objects Count', value: undefined},
      {subject: 'Pause Time Percentage', value: undefined},
      {subject: 'Index', value: undefined},
      {subject: 'Finalization Pending Count', value: 0},
      {subject: 'Compacted', value: false},
      {subject: 'Concurrent', value: false},
      {subject: 'Pause Durations', value: [0, 0]},
    ]);
  });
});
