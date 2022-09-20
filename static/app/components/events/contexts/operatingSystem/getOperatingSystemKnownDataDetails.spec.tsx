import {operatingSystemKnownDataValues} from 'sentry/components/events/contexts/operatingSystem';
import {getOperatingSystemKnownDataDetails} from 'sentry/components/events/contexts/operatingSystem/getOperatingSystemKnownDataDetails';

import {operatingSystemMockData} from './index.spec';

describe('getOperatingSystemKnownDataDetails', function () {
  it('returns values and according to the parameters', function () {
    const allKnownData: ReturnType<typeof getOperatingSystemKnownDataDetails>[] = [];

    for (const type of Object.keys(operatingSystemKnownDataValues)) {
      const operatingSystemKnownDataDetails = getOperatingSystemKnownDataDetails({
        type: operatingSystemKnownDataValues[type],
        data: operatingSystemMockData,
      });

      if (!operatingSystemKnownDataDetails) {
        continue;
      }

      allKnownData.push(operatingSystemKnownDataDetails);
    }

    expect(allKnownData).toEqual([
      {subject: 'Name', value: 'Mac OS X 10.14.0'},
      {subject: 'Version', value: ''},
      {subject: 'Kernel Version', value: ''},
      {subject: 'Rooted', value: null},
    ]);
  });
});
