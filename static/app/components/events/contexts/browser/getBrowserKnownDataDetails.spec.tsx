import {browserKnownDataValues} from 'sentry/components/events/contexts/browser';
import {getBrowserKnownDataDetails} from 'sentry/components/events/contexts/browser/getBrowserKnownDataDetails';

import {browserMockData} from './index.spec';

describe('getBrowserKnownDataDetails', function () {
  it('returns values and according to the parameters', function () {
    const allKnownData: ReturnType<typeof getBrowserKnownDataDetails>[] = [];

    for (const type of Object.keys(browserKnownDataValues)) {
      const deviceKnownData = getBrowserKnownDataDetails({
        type: browserKnownDataValues[type],
        data: browserMockData,
      });

      if (!deviceKnownData) {
        continue;
      }

      allKnownData.push(deviceKnownData);
    }

    expect(allKnownData).toEqual([
      {subject: 'Name', value: ''},
      {subject: 'Version', value: '83.0.4103'},
    ]);
  });
});
