import * as React from 'react';
import * as Sentry from '@sentry/react';

// Self reference to the module, so that we can mock a failed import in a test.
import * as selfModule from 'sentry/components/deviceName';
import {IOSDeviceList} from 'sentry/types/iOSDeviceList';

export function deviceNameMapper(
  model: string | undefined,
  module: IOSDeviceList | null
): string | null {
  // If we have no model, render nothing
  if (typeof model !== 'string') {
    return null;
  }

  // If module has not loaded yet, render the unparsed model
  if (module === null) {
    return model;
  }

  const [identifier, ...rest] = model.split(' ');

  const modelName = module.generationByIdentifier(identifier);
  return modelName === undefined ? model : `${modelName} ${rest.join(' ')}`;
}

export async function loadDeviceListModule(platform: 'iOS') {
  if (platform !== 'iOS') {
    Sentry.captureException('DeviceName component only supports iOS module');
  }
  return import('ios-device-list');
}

interface DeviceNameProps {
  value: string;
  children?: (name: string) => React.ReactNode;
}

/**
 * This is used to map iOS Device Names to model name.
 * This asynchronously loads the ios-device-list library because of its size
 */
function DeviceName({value, children}: DeviceNameProps): React.ReactElement | null {
  const [deviceList, setDeviceList] = React.useState<IOSDeviceList | null>(null);

  React.useEffect(() => {
    let didUnmount = false;

    selfModule
      .loadDeviceListModule('iOS')
      .then(module => {
        // We need to track component unmount so we dont try and setState on an unmounted component
        if (didUnmount) {
          return;
        }

        setDeviceList(module);
      })
      .catch(() => {
        Sentry.captureException('Failed to load ios-device-list module');
      });

    return () => {
      didUnmount = true;
    };
  }, []);

  const deviceName = React.useMemo(
    () => deviceNameMapper(value, deviceList),
    [value, deviceList]
  );

  return deviceName ? (
    <span data-test-id="loaded-device-name">
      {children ? children(deviceName) : deviceName}
    </span>
  ) : null;
}

export {DeviceName};
