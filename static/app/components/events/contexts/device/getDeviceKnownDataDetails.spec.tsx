import {Event as EventFixture} from 'sentry-fixture/event';

import {
  deviceKnownDataValues,
  getDeviceKnownDataDetails,
} from 'sentry/components/events/contexts/device/getDeviceKnownDataDetails';

import {deviceMockData} from './index.spec';

describe('getDeviceKnownDataDetails', function () {
  it('returns values and according to the parameters', function () {
    const allKnownData: ReturnType<typeof getDeviceKnownDataDetails>[] = [];

    for (const type of Object.keys(deviceKnownDataValues)) {
      const deviceKnownData = getDeviceKnownDataDetails({
        type: deviceKnownDataValues[type],
        data: deviceMockData,
        event: EventFixture(),
      });

      if (!deviceKnownData) {
        continue;
      }

      allKnownData.push(deviceKnownData);
    }

    expect(allKnownData).toEqual([
      {subject: 'Architecture', value: 'x86'},
      {subject: 'Battery Level', value: '100%'},
      {subject: 'Battery Status', value: undefined},
      expect.objectContaining({subject: 'Boot Time'}),
      {subject: 'Brand', value: 'google'},
      {subject: 'Charging', value: true},
      {subject: 'CPU Description', value: undefined},
      {subject: 'Device Type', value: undefined},
      expect.objectContaining({subject: 'External Free Storage'}),
      expect.objectContaining({subject: 'External Storage Size'}),
      {subject: 'Family', value: 'Android'},
      expect.objectContaining({subject: 'Free Memory'}),
      expect.objectContaining({subject: 'Free Storage'}),
      {subject: 'Low Memory', value: false},
      {subject: 'Manufacturer', value: 'Google'},
      expect.objectContaining({subject: 'Memory Size'}),
      expect.objectContaining({subject: 'Model'}),
      {subject: 'Model Id', value: 'NYC'},
      {subject: 'Name', value: ''},
      {subject: 'Online', value: true},
      {subject: 'Orientation', value: 'portrait'},
      {subject: 'Screen Density', value: 3},
      {subject: 'Screen DPI', value: 480},
      {subject: 'Screen Height Pixels', value: 1136},
      {subject: 'Screen Resolution', value: '1136x768'},
      {subject: 'Screen Width Pixels', value: 768},
      {subject: 'Simulator', value: true},
      expect.objectContaining({subject: 'Storage Size'}),
      {subject: 'Usable Memory', value: undefined},
      {subject: 'Memory', value: undefined},
      {
        subject: 'Capacity',
        value:
          'Total: 779.3 MiB / Free: 485.2 MiB (External Total: 510.0 MiB / Free: 509.9 MiB)',
      },
    ]);
  });
});
