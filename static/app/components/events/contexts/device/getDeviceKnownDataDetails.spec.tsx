import {Event} from 'fixtures/js-stubs/event';

import {deviceKnownDataValues} from 'sentry/components/events/contexts/device';
import {getDeviceKnownDataDetails} from 'sentry/components/events/contexts/device/getDeviceKnownDataDetails';

import {deviceMockData} from './index.spec';

describe('getDeviceKnownDataDetails', function () {
  it('returns values and according to the parameters', function () {
    const allKnownData: ReturnType<typeof getDeviceKnownDataDetails>[] = [];

    for (const type of Object.keys(deviceKnownDataValues)) {
      const deviceKnownData = getDeviceKnownDataDetails({
        type: deviceKnownDataValues[type],
        data: deviceMockData,
        event: Event(),
      });

      if (!deviceKnownData) {
        continue;
      }

      allKnownData.push(deviceKnownData);
    }

    expect(allKnownData).toEqual([
      {subject: 'Name', value: ''},
      {subject: 'Family', value: 'Android'},
      {subject: 'CPU Description', value: undefined},
      {subject: 'Architecture', value: 'x86'},
      {subject: 'Battery Level', value: '100%'},
      {subject: 'Battery Status', value: undefined},
      {subject: 'Orientation', value: 'portrait'},
      {subject: 'Memory', value: undefined},
      expect.objectContaining({subject: 'Memory Size'}),
      expect.objectContaining({subject: 'Free Memory'}),
      {subject: 'Usable Memory', value: undefined},
      {subject: 'Low Memory', value: false},
      expect.objectContaining({subject: 'Storage Size'}),
      expect.objectContaining({subject: 'External Storage Size'}),
      expect.objectContaining({subject: 'External Free Storage'}),
      {
        subject: 'Capacity',
        value:
          'Total: 779.3 MiB / Free: 485.2 MiB (External Total: 510.0 MiB / Free: 509.9 MiB)',
      },
      expect.objectContaining({subject: 'Free Storage'}),
      {subject: 'Simulator', value: true},
      expect.objectContaining({subject: 'Boot Time'}),
      {subject: 'Timezone', value: 'America/Los_Angeles'},
      {subject: 'Device Type', value: undefined},
      {subject: 'Architectures', value: ['x86']},
      {subject: 'Brand', value: 'google'},
      {subject: 'Charging', value: true},
      {subject: 'Connection Type', value: undefined},
      {subject: 'Id', value: undefined},
      {subject: 'Language', value: undefined},
      {subject: 'Manufacturer', value: 'Google'},
      {subject: 'Online', value: true},
      {subject: 'Screen Density', value: 3},
      {subject: 'Screen DPI', value: 480},
      {subject: 'Screen Resolution', value: '1136x768'},
      {subject: 'Screen Height Pixels', value: 1136},
      {subject: 'Screen Width Pixels', value: 768},
      expect.objectContaining({subject: 'Model'}),
      {subject: 'Model Id', value: 'NYC'},
      {subject: 'Rendered Model', value: undefined},
    ]);
  });
});
