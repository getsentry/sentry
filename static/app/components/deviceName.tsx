import * as React from 'react';
import * as Sentry from '@sentry/react';

// Self reference to the module, so that we can mock a failed import in a test.
import * as selfModule from 'sentry/components/deviceName';
import {IOSDeviceList} from 'sentry/types/iOSDeviceList';

export function iOSDeviceNameMapper(
  model: string | undefined,
  iOSDeviceList: IOSDeviceList | null
): string | null {
  // If we have no model, render nothing
  if (typeof model !== 'string') {
    return null;
  }

  // If module has not loaded yet, render the unparsed model
  if (iOSDeviceList === null) {
    return model;
  }

  const [identifier, ...rest] = model.split(' ');

  const modelName = iOSDeviceList.generationByIdentifier(identifier);
  return modelName === undefined ? model : `${modelName} ${rest.join(' ')}`;
}

export async function loadiOSDeviceListModule() {
  return import('ios-device-list');
}

interface DeviceNameProps {
  value: string | undefined;
  children?: (name: string) => React.ReactNode;
}

/**
 * This is used to map iOS Device Names to model name.
 * This asynchronously loads the ios-device-list library because of its size
 */
function DeviceName({value, children}: DeviceNameProps): React.ReactNode {
  const [iOSDeviceList, setiOSDeviceList] = React.useState<IOSDeviceList | null>(null);

  React.useEffect(() => {
    let didUnmount = false;

    selfModule
      .loadiOSDeviceListModule()
      .then(deviceList => {
        if (didUnmount) {
          return;
        }

        setiOSDeviceList(deviceList);
      })
      .catch(() => {
        Sentry.captureException('Failed to load ios-device-list module');
      });

    return () => {
      didUnmount = true;
    };
  }, []);

  const deviceName = React.useMemo(
    () => iOSDeviceNameMapper(value, iOSDeviceList),
    [value, iOSDeviceList]
  );

  // If there is no value, render nothing
  if (!deviceName) {
    return null;
  }

  return (
    <span data-test-id="loaded-device-name">
      {children ? children(deviceName) : deviceName}
    </span>
  );
}

export {DeviceName};
