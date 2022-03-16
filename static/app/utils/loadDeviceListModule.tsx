import * as Sentry from '@sentry/react';

import {IOSDeviceList} from 'sentry/types/iOSDeviceList';

export async function loadDeviceListModule(platform: 'iOS'): Promise<IOSDeviceList> {
  if (platform !== 'iOS') {
    Sentry.captureException('DeviceName component only supports iOS module');
  }
  return await import('ios-device-list');
}
