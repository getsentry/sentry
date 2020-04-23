import React from 'react';

import ContextBlock from 'app/components/events/contexts/contextBlockV2';

import {DeviceData, DeviceKnownDataType} from './types';
import getDeviceKnownData from './getDeviceKnownData';

type Props = {
  data: DeviceData;
};

const deviceKnownDataValues = [
  DeviceKnownDataType.NAME,
  DeviceKnownDataType.FAMILY,
  DeviceKnownDataType.CPU_DESCRIPTION,
  DeviceKnownDataType.ARCH,
  DeviceKnownDataType.BATTERY_LEVEL,
  DeviceKnownDataType.BATTERY_STATUS,
  DeviceKnownDataType.ORIENTATION,
  DeviceKnownDataType.MEMORY,
  DeviceKnownDataType.STORAGE,
  DeviceKnownDataType.SIMULATOR,
  DeviceKnownDataType.BOOT_TIME,
  DeviceKnownDataType.TIMEZONE,
  DeviceKnownDataType.DEVICE_TYPE,
  DeviceKnownDataType.ARCHS,
  DeviceKnownDataType.BRAND,
  DeviceKnownDataType.CHARGING,
  DeviceKnownDataType.CONNECTION_TYPE,
  DeviceKnownDataType.ID,
  DeviceKnownDataType.LANGUAGE,
  DeviceKnownDataType.LOW_MEMORY,
  DeviceKnownDataType.MANUFACTURER,
  DeviceKnownDataType.ONLINE,
  DeviceKnownDataType.SCREEN_DENSITY,
  DeviceKnownDataType.SCREEN_DPI,
  DeviceKnownDataType.SCREEN_HEIGHT_PIXELS,
  DeviceKnownDataType.SCREEN_RESOLUTION,
  DeviceKnownDataType.SCREEN_WIDTH_PIXELS,
  DeviceKnownDataType.MODEL,
];

const Device = ({data}: Props) => (
  <ContextBlock knownData={getDeviceKnownData(data, deviceKnownDataValues)} />
);

Device.getTitle = () => 'Device';

export default Device;
