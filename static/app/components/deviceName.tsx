import * as React from 'react';

import {IOSDeviceList} from 'sentry/types/iOSDeviceList';

export function iOSDeviceNameMapper(
  model: string | undefined,
  iOSDeviceList: IOSDeviceList | null
): string | null {
  // If we have no model, render nothing
  if (model === undefined) {
    return null;
  }

  // If module has not loaded yet, render the unparsed model
  if (iOSDeviceList === null) {
    return model;
  }

  const components = model.split(' ');
  const modelIdentifier = components[0];
  const modelId = components.splice(1).join(' ');

  const modelName = iOSDeviceList.generationByIdentifier(modelIdentifier);
  return modelName === undefined ? model : `${modelName} ${modelId}`;
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
    loadiOSDeviceListModule().then(deviceList => {
      if (didUnmount) {
        return;
      }

      setiOSDeviceList(deviceList);
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
