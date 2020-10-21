import { Fragment } from 'react';

import ContextBlock from 'app/components/events/contexts/contextBlock';

import {DeviceData, DeviceKnownDataType} from './types';
import getDeviceKnownData from './getDeviceKnownData';
import getUnknownData from '../getUnknownData';

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
  DeviceKnownDataType.MEMORY_SIZE,
  DeviceKnownDataType.FREE_MEMORY,
  DeviceKnownDataType.USABLE_MEMORY,
  DeviceKnownDataType.LOW_MEMORY,
  DeviceKnownDataType.STORAGE_SIZE,
  DeviceKnownDataType.EXTERNAL_STORAGE_SIZE,
  DeviceKnownDataType.EXTERNAL_FREE_STORAGE,
  DeviceKnownDataType.STORAGE,
  DeviceKnownDataType.FREE_STORAGE,
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
  DeviceKnownDataType.MANUFACTURER,
  DeviceKnownDataType.ONLINE,
  DeviceKnownDataType.SCREEN_DENSITY,
  DeviceKnownDataType.SCREEN_DPI,
  DeviceKnownDataType.SCREEN_HEIGHT_PIXELS,
  DeviceKnownDataType.SCREEN_RESOLUTION,
  DeviceKnownDataType.SCREEN_WIDTH_PIXELS,
  DeviceKnownDataType.MODEL,
  DeviceKnownDataType.MODEL_ID,
  DeviceKnownDataType.RENDERED_MODEL,
];

const deviceIgnoredDataValues = [];

const Device = ({data}: Props) => (
  <Fragment>
    <ContextBlock data={getDeviceKnownData(data, deviceKnownDataValues)} />
    <ContextBlock
      data={getUnknownData(data, [...deviceKnownDataValues, ...deviceIgnoredDataValues])}
    />
  </Fragment>
);

export default Device;
