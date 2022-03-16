import {useEffect, useMemo, useState} from 'react';
import * as Sentry from '@sentry/react';

import {IOSDeviceList} from 'sentry/types/iOSDeviceList';
import {loadDeviceListModule} from 'sentry/utils/loadDeviceListModule';

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

interface DeviceNameProps {
  value: string;
  children?: (name: string) => React.ReactNode;
}

/**
 * This is used to map iOS Device Names to model name.
 * This asynchronously loads the ios-device-list library because of its size
 */
function DeviceName({value, children}: DeviceNameProps): React.ReactElement | null {
  const [deviceList, setDeviceList] = useState<IOSDeviceList | null>(null);

  useEffect(() => {
    let didUnmount = false;

    loadDeviceListModule('iOS')
      .then(module => {
        // We need to track component unmount so we dont try and setState on an unmounted component
        if (!didUnmount) {
          return;
        }
        setDeviceList(module);
      })
      .catch(() => {
        // We need to track component unmount so we dont try and setState on an unmounted component
        if (didUnmount) {
          return;
        }
        Sentry.captureException('Failed to load ios-device-list module');
      });

    return () => {
      didUnmount = true;
    };
  }, []);

  const deviceName = useMemo(
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
