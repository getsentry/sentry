import {EventFixture} from 'sentry-fixture/event';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ContextCard from 'sentry/components/events/contexts/contextCard';
import {getDeviceContextData} from 'sentry/components/events/contexts/knownContext/device';
import type {DeviceContext} from 'sentry/types/event';

const MOCK_DEVICE_CONTEXT: DeviceContext = {
  name: '', // redacted
  screen_resolution: '1136x768',
  orientation: 'portrait',
  family: 'Android',
  battery_level: 100,
  battery_temperature: 45,
  screen_dpi: 480,
  memory_size: 1055186944,
  timezone: 'America/Los_Angeles',
  external_storage_size: 534761472,
  external_free_storage: 534702080,
  screen_width_pixels: 768,
  low_memory: false,
  simulator: true,
  screen_height_pixels: 1136,
  free_memory: 658702336,
  online: true,
  screen_density: 3,
  type: 'device',
  charging: true,
  model_id: 'NYC',
  brand: 'google',
  storage_size: 817143808,
  boot_time: '2019-12-11T11:38:15Z',
  arch: 'x86',
  manufacturer: 'Google',
  free_storage: 508784640,
  model: 'Android SDK built for x86',
};

const MOCK_REDACTION = {
  name: {
    '': {
      rem: [['organization:0', 's', 0, 0]],
      len: 25,
    },
  },
};

describe('DeviceContext', function () {
  it('returns values and according to the parameters', function () {
    // We need to use expect.anything() for some fields as they return React components.
    expect(
      getDeviceContextData({data: MOCK_DEVICE_CONTEXT, event: EventFixture()})
    ).toEqual([
      {key: 'name', subject: 'Name', value: ''},
      {
        key: 'screen_resolution',
        subject: 'Screen Resolution',
        value: '1136x768',
      },
      {key: 'orientation', subject: 'Orientation', value: 'portrait'},
      {key: 'family', subject: 'Family', value: 'Android'},
      {key: 'battery_level', subject: 'Battery Level', value: '100%'},
      {
        key: 'battery_temperature',
        subject: 'Battery Temperature (°C)',
        value: 45,
      },
      {key: 'screen_dpi', subject: 'Screen DPI', value: 480},
      {
        key: 'memory_size',
        subject: 'Memory Size',
        value: expect.anything(),
      },
      {
        key: 'timezone',
        subject: 'timezone',
        value: 'America/Los_Angeles',
        meta: undefined,
      },
      {
        key: 'external_storage_size',
        subject: 'External Storage Size',
        value: expect.anything(),
      },
      {
        key: 'external_free_storage',
        subject: 'External Free Storage',
        value: expect.anything(),
      },
      {
        key: 'screen_width_pixels',
        subject: 'Screen Width Pixels',
        value: 768,
      },
      {key: 'low_memory', subject: 'Low Memory', value: false},
      {key: 'simulator', subject: 'Simulator', value: true},
      {
        key: 'screen_height_pixels',
        subject: 'Screen Height Pixels',
        value: 1136,
      },
      {
        key: 'free_memory',
        subject: 'Free Memory',
        value: expect.anything(),
      },
      {key: 'online', subject: 'Online', value: true},
      {key: 'screen_density', subject: 'Screen Density', value: 3},
      {key: 'charging', subject: 'Charging', value: true},
      {key: 'model_id', subject: 'Model Id', value: 'NYC'},
      {key: 'brand', subject: 'Brand', value: 'google'},
      {
        key: 'storage_size',
        subject: 'Storage Size',
        value: expect.anything(),
      },
      {
        key: 'boot_time',
        subject: 'Boot Time',
        value: expect.anything(),
      },
      {key: 'arch', subject: 'Architecture', value: 'x86'},
      {key: 'manufacturer', subject: 'Manufacturer', value: 'Google'},
      {
        key: 'free_storage',
        subject: 'Free Storage',
        value: expect.anything(),
      },
      {
        key: 'model',
        subject: 'Model',
        value: expect.anything(),
      },
    ]);
  });

  it('renders with meta annotations correctly', function () {
    const event = EventFixture({
      _meta: {contexts: {device: MOCK_REDACTION}},
    });

    render(
      <ContextCard
        event={event}
        type={'device'}
        alias={'device'}
        value={{...MOCK_DEVICE_CONTEXT, name: ''}}
      />
    );

    expect(screen.getByText('Device')).toBeInTheDocument();
    expect(screen.getByText('Orientation')).toBeInTheDocument();
    expect(screen.getByText('portrait')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText(/redacted/)).toBeInTheDocument();
  });
});
