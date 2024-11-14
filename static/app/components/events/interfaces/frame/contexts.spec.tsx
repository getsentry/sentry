import {EventFixture} from 'sentry-fixture/event';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DeviceEventContext} from 'sentry/components/events/contexts/device';
import {commonDisplayResolutions} from 'sentry/components/events/contexts/device/utils';
import type {DeviceContext} from 'sentry/types/event';

describe('Device', function () {
  const device: DeviceContext = {
    type: 'device',
    name: 'Device Name',
    screen_resolution: '3840x2160',
    screen_width_pixels: 3840,
    screen_height_pixels: 2160,
    device_type: 'desktop',
  };

  describe('getInferredData', function () {
    it('renders', function () {
      render(<DeviceEventContext data={device} event={EventFixture()} />);
    });

    it('renders screen_resolution inferred from screen_width_pixels and screen_height_pixels', function () {
      render(
        <DeviceEventContext
          data={{...device, screen_resolution: undefined}}
          event={EventFixture()}
        />
      );

      expect(
        screen.getByTestId('device-context-screen_width_pixels-value')
      ).toHaveTextContent(String(device.screen_width_pixels));

      expect(
        screen.getByTestId('device-context-screen_height_pixels-value')
      ).toHaveTextContent(String(device.screen_height_pixels));

      expect(
        screen.getByTestId('device-context-screen_resolution-value')
      ).toHaveTextContent(
        `${device.screen_resolution} (${
          commonDisplayResolutions[String(device.screen_resolution)]
        })`
      );
    });

    it('renders screen_width_pixels and screen_height_pixels inferred from screen_resolution', function () {
      render(
        <DeviceEventContext
          data={{
            ...device,
            screen_width_pixels: undefined,
            screen_height_pixels: undefined,
          }}
          event={EventFixture()}
        />
      );

      expect(
        screen.getByTestId('device-context-screen_width_pixels-value')
      ).toHaveTextContent(String(device.screen_width_pixels));

      expect(
        screen.getByTestId('device-context-screen_height_pixels-value')
      ).toHaveTextContent(String(device.screen_height_pixels));

      expect(
        screen.getByTestId('device-context-screen_resolution-value')
      ).toHaveTextContent(
        `${device.screen_resolution} (${
          commonDisplayResolutions[String(device.screen_resolution)]
        })`
      );
    });
  });
});
