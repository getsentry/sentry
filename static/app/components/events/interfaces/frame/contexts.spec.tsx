import {Event as EventFixture} from 'sentry-fixture/event';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DeviceEventContext} from 'sentry/components/events/contexts/device';
import {commonDisplayResolutions} from 'sentry/components/events/contexts/device/utils';
import {UserEventContext} from 'sentry/components/events/contexts/user';
import {FILTER_MASK} from 'sentry/constants';
import {DeviceContext} from 'sentry/types';

describe('User', function () {
  it("displays filtered values but doesn't use them for avatar", function () {
    const {rerender} = render(
      <UserEventContext
        data={{
          id: '26',
          name: FILTER_MASK,
          email: '',
          username: '',
          ip_address: '',
          data: {},
        }}
        event={EventFixture()}
      />
    );

    expect(screen.getByTestId('user-context-name-value')).toHaveTextContent(FILTER_MASK);
    expect(screen.getByText('?')).toBeInTheDocument();

    rerender(
      <UserEventContext
        data={{
          id: '26',
          name: '',
          email: FILTER_MASK,
          username: '',
          ip_address: '',
          data: {},
        }}
        event={EventFixture()}
      />
    );

    expect(screen.getByTestId('user-context-email-value')).toHaveTextContent(FILTER_MASK);
    expect(screen.getByText('?')).toBeInTheDocument();

    rerender(
      <UserEventContext
        data={{
          id: '26',
          name: '',
          email: '',
          username: FILTER_MASK,
          ip_address: '',
          data: {},
        }}
        event={EventFixture()}
      />
    );

    expect(screen.getByTestId('user-context-username-value')).toHaveTextContent(
      FILTER_MASK
    );
    expect(screen.getByText('?')).toBeInTheDocument();
  });
});

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
