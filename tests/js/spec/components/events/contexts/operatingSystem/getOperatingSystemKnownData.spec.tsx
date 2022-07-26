import {getOperatingSystemKnownData} from 'sentry/components/events/contexts/operatingSystem/getOperatingSystemKnownData';

import {operatingSystemMetaMockData, operatingSystemMockData} from './index.spec';

describe('getOperatingSystemKnownData', function () {
  it('filters data and transforms into the right way', function () {
    const operatingSystemKnownData = getOperatingSystemKnownData({
      data: operatingSystemMockData,
      meta: operatingSystemMetaMockData,
    });

    expect(operatingSystemKnownData).toEqual([
      {
        key: 'name',
        subject: 'Name',
        value: 'Mac OS X 10.14.0',
        meta: undefined,
      },
      {key: 'version', subject: 'Version', value: '', meta: undefined},
      {
        key: 'kernel_version',
        subject: 'Kernel Version',
        value: '',
        meta: undefined,
      },
    ]);
  });
});
