import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DeviceEventContext} from 'sentry/components/events/contexts/device';
import {commonDisplayResolutions} from 'sentry/components/events/contexts/device/utils';
import {UserEventContext} from 'sentry/components/events/contexts/user';
import {FILTER_MASK} from 'sentry/constants';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';

function ComponentProviders({children}: {children: React.ReactNode}) {
  const {organization, router} = initializeOrg();

  return (
    <OrganizationContext.Provider value={organization}>
      <RouteContext.Provider
        value={{
          router,
          location: router.location,
          params: {},
          routes: [],
        }}
      >
        {children}
      </RouteContext.Provider>
    </OrganizationContext.Provider>
  );
}

describe('User', function () {
  it("displays filtered values but doesn't use them for avatar", function () {
    const {rerender} = render(
      <ComponentProviders>
        <UserEventContext
          data={{
            id: '26',
            name: FILTER_MASK,
            email: '',
            username: '',
            ip_address: '',
            data: {},
          }}
          event={TestStubs.Event()}
        />
      </ComponentProviders>
    );

    expect(screen.getByTestId('user-context-name-value')).toHaveTextContent(FILTER_MASK);
    expect(screen.getByText('?')).toBeInTheDocument();

    rerender(
      <ComponentProviders>
        <UserEventContext
          data={{
            id: '26',
            name: '',
            email: FILTER_MASK,
            username: '',
            ip_address: '',
            data: {},
          }}
          event={TestStubs.Event()}
        />
      </ComponentProviders>
    );

    expect(screen.getByTestId('user-context-email-value')).toHaveTextContent(FILTER_MASK);
    expect(screen.getByText('?')).toBeInTheDocument();

    rerender(
      <ComponentProviders>
        <UserEventContext
          data={{
            id: '26',
            name: '',
            email: '',
            username: FILTER_MASK,
            ip_address: '',
            data: {},
          }}
          event={TestStubs.Event()}
        />
      </ComponentProviders>
    );

    expect(screen.getByTestId('user-context-username-value')).toHaveTextContent(
      FILTER_MASK
    );
    expect(screen.getByText('?')).toBeInTheDocument();
  });
});

describe('Device', function () {
  const device = {
    name: 'Device Name',
    screen_resolution: '3840x2160',
    screen_width_pixels: 3840,
    screen_height_pixels: 2160,
    device_type: 'desktop',
  };

  describe('getInferredData', function () {
    it('renders', function () {
      const {container} = render(
        <ComponentProviders>
          <DeviceEventContext data={device} event={TestStubs.Event()} />
        </ComponentProviders>
      );

      expect(container).toSnapshot();
    });

    it('renders screen_resolution inferred from screen_width_pixels and screen_height_pixels', function () {
      render(
        <ComponentProviders>
          <DeviceEventContext
            data={{...device, screen_resolution: undefined}}
            event={TestStubs.Event()}
          />
        </ComponentProviders>
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
          commonDisplayResolutions[device.screen_resolution]
        })`
      );
    });

    it('renders screen_width_pixels and screen_height_pixels inferred from screen_resolution', function () {
      render(
        <ComponentProviders>
          <DeviceEventContext
            data={{
              ...device,
              screen_width_pixels: undefined,
              screen_height_pixels: undefined,
            }}
            event={TestStubs.Event()}
          />
        </ComponentProviders>
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
          commonDisplayResolutions[device.screen_resolution]
        })`
      );
    });
  });
});
