import {getOperatingSystemKnownDataDetails} from 'sentry/components/events/contexts/operatingSystem/getOperatingSystemKnownDataDetails';
import {OperatingSystemKnownDataType} from 'sentry/components/events/contexts/operatingSystem/types';

import {operatingSystemMockData} from './index.spec';

describe('getOperatingSystemKnownDataDetails', function () {
  it('returns values and according to the parameters', function () {
    const allKnownData: ReturnType<typeof getOperatingSystemKnownDataDetails>[] = [];

    for (const type of Object.keys(OperatingSystemKnownDataType)) {
      const operatingSystemKnownDataDetails = getOperatingSystemKnownDataDetails({
        type: OperatingSystemKnownDataType[type],
        data: operatingSystemMockData,
      });

      if (!operatingSystemKnownDataDetails) {
        continue;
      }

      allKnownData.push(operatingSystemKnownDataDetails);
    }

    expect(allKnownData).toEqual([
      {subject: 'Name', value: 'Linux'},
      {subject: 'Version', value: '6.1.82'},
      {subject: 'Build', value: '20C69'},
      {subject: 'Kernel Version', value: '99.168.amzn2023.x86_64'},
      {subject: 'Rooted', value: 'yes'},
      {subject: 'Theme', value: 'dark'},
      {subject: 'Raw Description', value: ''},
      {subject: 'Distro', value: 'Amazon Linux 2023.4.20240401'},
    ]);
  });
});
