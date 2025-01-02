import {useMemo} from 'react';

import {iOSDeviceMapping} from 'sentry/constants/ios-device-list';

export function deviceNameMapper(model: string | undefined): string | null {
  // If we have no model, render nothing
  if (typeof model !== 'string') {
    return null;
  }

  // If module has not loaded yet, render the unparsed model
  if (module === null) {
    return model;
  }

  const [identifier, ...rest] = model.split(' ');

  const modelName = iOSDeviceMapping[identifier!];
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
  const deviceName = useMemo(() => deviceNameMapper(value), [value]);

  return deviceName ? (
    <span data-test-id="loaded-device-name">
      {children ? children(deviceName) : deviceName}
    </span>
  ) : null;
}

export {DeviceName};
