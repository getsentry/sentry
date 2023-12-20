import {Event as EventFixture} from 'sentry-fixture/event';

import {
  getThreadPoolInfoKnownDataDetails,
  threadPoolInfoKnownDataValues,
} from 'sentry/components/events/contexts/threadPoolInfo/getThreadPoolInfoKnownDataDetails';

import {threadPoolInfoMockData} from './index.spec';

describe('getThreadPoolInfoKnownDataDetails', function () {
  it('returns values and according to the parameters', function () {
    const allKnownData: ReturnType<typeof getThreadPoolInfoKnownDataDetails>[] = [];

    for (const type of Object.keys(threadPoolInfoKnownDataValues)) {
      const threadPoolInfoKnownData = getThreadPoolInfoKnownDataDetails({
        type: threadPoolInfoKnownDataValues[type],
        data: threadPoolInfoMockData,
        event: EventFixture(),
      });

      if (!threadPoolInfoKnownData) {
        continue;
      }

      allKnownData.push(threadPoolInfoKnownData);
    }

    expect(allKnownData).toEqual([
      {subject: 'Min Worker Threads', value: 10},
      {subject: 'Min Completion Port Threads', value: 1},
      {subject: 'Max Worker Threads', value: 32767},
      {subject: 'Max Completion Port Threads', value: 1000},
      {subject: 'Available Worker Threads', value: 32766},
      {subject: 'Available Completion Port Threads', value: 1000},
    ]);
  });
});
