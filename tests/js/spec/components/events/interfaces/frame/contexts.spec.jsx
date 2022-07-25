import {mountWithTheme} from 'sentry-test/enzyme';

import {DeviceEventContext} from 'sentry/components/events/contexts/device';
import {commonDisplayResolutions} from 'sentry/components/events/contexts/device/utils';
import {UserEventContext} from 'sentry/components/events/contexts/user';
import {FILTER_MASK} from 'sentry/constants';

describe('User', function () {
  it("displays filtered values but doesn't use them for avatar", function () {
    const user1 = {
      id: '26',
      name: FILTER_MASK,
    };

    const wrapper1 = mountWithTheme(
      <UserEventContext data={user1} event={TestStubs.Event()} />
    );
    expect(wrapper1.find('[data-test-id="user-context-name-value"]').text()).toEqual(
      FILTER_MASK
    );
    expect(wrapper1.find('LetterAvatar').text()).toEqual('?');

    const user2 = {
      id: '26',
      email: FILTER_MASK,
    };

    const wrapper2 = mountWithTheme(
      <UserEventContext data={user2} event={TestStubs.Event()} />
    );
    expect(wrapper2.find('[data-test-id="user-context-email-value"]').text()).toEqual(
      FILTER_MASK
    );
    expect(wrapper2.find('LetterAvatar').text()).toEqual('?');

    const user3 = {
      id: '26',
      username: FILTER_MASK,
    };

    const wrapper3 = mountWithTheme(
      <UserEventContext data={user3} event={TestStubs.Event()} />
    );
    expect(wrapper3.find('[data-test-id="user-context-username-value"]').text()).toEqual(
      FILTER_MASK
    );
    expect(wrapper3.find('LetterAvatar').text()).toEqual('?');
  });
});

describe('Device', function () {
  const event = TestStubs.Event();
  const device = {
    name: 'Device Name',
    screen_resolution: '3840x2160',
    screen_width_pixels: 3840,
    screen_height_pixels: 2160,
  };

  describe('getInferredData', function () {
    it('renders', function () {
      const wrapper = mountWithTheme(<DeviceEventContext data={device} event={event} />);
      expect(wrapper).toSnapshot();
    });

    it('renders screen_resolution inferred from screen_width_pixels and screen_height_pixels', function () {
      const wrapper = mountWithTheme(
        <DeviceEventContext
          data={{...device, screen_resolution: undefined}}
          event={event}
        />
      );

      expect(
        wrapper.find('[data-test-id="device-context-screen_width_pixels-value"]').text()
      ).toEqual(String(device.screen_width_pixels));

      expect(
        wrapper.find('[data-test-id="device-context-screen_height_pixels-value"]').text()
      ).toEqual(String(device.screen_height_pixels));

      expect(
        wrapper.find('[data-test-id="device-context-screen_resolution-value"]').text()
      ).toEqual(
        `${device.screen_resolution} (${
          commonDisplayResolutions[device.screen_resolution]
        })`
      );
    });

    it('renders screen_width_pixels and screen_height_pixels inferred from screen_resolution', function () {
      const wrapper = mountWithTheme(
        <DeviceEventContext
          data={{
            ...device,
            screen_width_pixels: undefined,
            screen_height_pixels: undefined,
          }}
          event={event}
        />
      );

      expect(
        wrapper.find('[data-test-id="device-context-screen_width_pixels-value"]').text()
      ).toEqual(String(device.screen_width_pixels));

      expect(
        wrapper.find('[data-test-id="device-context-screen_height_pixels-value"]').text()
      ).toEqual(String(device.screen_height_pixels));

      expect(
        wrapper.find('[data-test-id="device-context-screen_resolution-value"]').text()
      ).toEqual(
        `${device.screen_resolution} (${
          commonDisplayResolutions[device.screen_resolution]
        })`
      );
    });
  });
});
