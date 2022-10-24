import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {DeviceEventContext} from 'sentry/components/events/contexts/device';
import {DeviceData} from 'sentry/components/events/contexts/device/types';

export const deviceMockData = {
  screen_resolution: '1136x768',
  orientation: 'portrait',
  family: 'Android',
  battery_level: 100,
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
  locale: 'US',
  model_id: 'NYC',
  brand: 'google',
  storage_size: 817143808,
  boot_time: '2019-12-11T11:38:15Z',
  arch: 'x86',
  manufacturer: 'Google',
  name: '', // redacted
  free_storage: 508784640,
  model: 'Android SDK built for x86',
  uuid: 'abadcade-feed-dead-beef-baddadfeeded',
  archs: ['x86'],
} as unknown as DeviceData;

export const deviceContextMetaMockData = {
  name: {
    '': {
      rem: [['organization:0', 's', 0, 0]],
      len: 25,
    },
  },
};

const event = {
  ...TestStubs.Event(),
  _meta: {
    contexts: {
      device: deviceContextMetaMockData,
    },
  },
};

describe('device event context', function () {
  it('display redacted data', async function () {
    render(<DeviceEventContext event={event} data={deviceMockData} />, {
      organization: {
        relayPiiConfig: JSON.stringify(TestStubs.DataScrubbingRelayPiiConfig()),
      },
    });
    expect(screen.getByText('Name')).toBeInTheDocument(); // subject
    expect(screen.getByText(/redacted/)).toBeInTheDocument(); // value
    userEvent.hover(screen.getByText(/redacted/));
    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          "Replaced because of the data scrubbing rule [Replace] [Password fields] with [Scrubbed] from [password] in your organization's settings"
        )
      )
    ).toBeInTheDocument(); // tooltip description
  });
});
