import {runtimeKnownDataValues} from 'sentry/components/events/contexts/runtime';
import {getRuntimeKnownDataDetails} from 'sentry/components/events/contexts/runtime/getRuntimeKnownDataDetails';

import {runtimeMockData} from './index.spec';

describe('getRuntimeKnownDataDetails', function () {
  it('returns values and according to the parameters', function () {
    const allKnownData: ReturnType<typeof getRuntimeKnownDataDetails>[] = [];

    for (const type of Object.keys(runtimeKnownDataValues)) {
      const runtimeKnownData = getRuntimeKnownDataDetails({
        type: runtimeKnownDataValues[type],
        data: runtimeMockData,
      });

      if (!runtimeKnownData) {
        return;
      }

      allKnownData.push(runtimeKnownData);
    }

    expect(allKnownData).toEqual([
      {
        subject: 'Name',
        value: '',
      },
      {
        subject: 'Version',
        value: '1.7.13(2.7.18 (default, Apr 20 2020, 19:34:11) \n[GCC 8.3.0])',
      },
    ]);
  });
});
