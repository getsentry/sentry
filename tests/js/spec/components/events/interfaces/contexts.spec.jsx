import {mountWithTheme} from 'sentry-test/enzyme';

import Device from 'app/components/events/contexts/device/device';
import {commonDisplayResolutions} from 'app/components/events/contexts/device/utils';
import User from 'app/components/events/contexts/user/user';
import {FILTER_MASK} from 'app/constants';

describe('User', function () {
  it("displays filtered values but doesn't use them for avatar", function () {
    const user1 = {
      id: '26',
      name: FILTER_MASK,
    };

    const wrapper1 = mountWithTheme(<User data={user1} />);
    expect(wrapper1.find('[data-test-id="user-context-name-value"]').text()).toEqual(
      FILTER_MASK
    );
    expect(wrapper1.find('LetterAvatar').text()).toEqual('?');

    const user2 = {
      id: '26',
      email: FILTER_MASK,
    };

    const wrapper2 = mountWithTheme(<User data={user2} />);
    expect(wrapper2.find('[data-test-id="user-context-email-value"]').text()).toEqual(
      FILTER_MASK
    );
    expect(wrapper2.find('LetterAvatar').text()).toEqual('?');

    const user3 = {
      id: '26',
      username: FILTER_MASK,
    };

    const wrapper3 = mountWithTheme(<User data={user3} />);
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
      const wrapper = mountWithTheme(<Device data={device} event={event} />);
      expect(wrapper).toSnapshot();
    });

    it('renders screen_resolution inferred from screen_width_pixels and screen_height_pixels', function () {
      const wrapper = mountWithTheme(
        <Device data={{...device, screen_resolution: undefined}} event={event} />
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
        <Device
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
