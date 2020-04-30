import React from 'react';

import {t} from 'app/locale';
import {defined} from 'app/utils';
import DeviceName from 'app/components/deviceName';

import formatMemory from './formatMemory';
import formatStorage from './formatStorage';
import {DeviceKnownDataType, DeviceData} from './types';

type Output = {
  subject: string;
  value?: React.ReactNode;
};

function getDeviceKnownDataDetails(data: DeviceData, type: DeviceKnownDataType): Output {
  switch (type) {
    case DeviceKnownDataType.NAME:
      return {
        subject: t('Name'),
        value: data.name,
      };
    case DeviceKnownDataType.FAMILY:
      return {
        subject: t('Family'),
        value: data.family,
      };
    case DeviceKnownDataType.MODEL:
      return {
        subject: t('Model'),
        value:
          typeof data.model === 'string' ? (
            <DeviceName
              value={`${data.model} ${data?.model_id ? `(${data.model_id})` : ''}`}
            />
          ) : (
            undefined
          ),
      };
    case DeviceKnownDataType.CPU_DESCRIPTION:
      return {
        subject: t('CPU Description'),
        value: data.cpu_description,
      };
    case DeviceKnownDataType.ARCH:
      return {
        subject: t('Architecture'),
        value: data.arch,
      };
    case DeviceKnownDataType.BATTERY_LEVEL:
      return {
        subject: t('Battery Level'),
        value: defined(data.battery_level) ? `${data.battery_level}%` : undefined,
      };
    case DeviceKnownDataType.BATTERY_STATUS:
      return {
        subject: t('Battery Status'),
        value: data.battery_status,
      };
    case DeviceKnownDataType.ORIENTATION:
      return {
        subject: t('Orientation'),
        value: data.orientation,
      };
    case DeviceKnownDataType.MEMORY:
      const {memory_size, free_memory, usable_memory} = data;
      return {
        subject: t('Memory'),
        value:
          memory_size && free_memory && usable_memory
            ? formatMemory(memory_size, free_memory, usable_memory)
            : undefined,
      };
    case DeviceKnownDataType.STORAGE:
      const {
        storage_size,
        free_storage,
        external_storage_size,
        external_free_storage,
      } = data;
      return {
        subject: t('Capacity'),
        value:
          storage_size && free_storage && external_storage_size && external_free_storage
            ? formatStorage(
                storage_size,
                free_storage,
                external_storage_size,
                external_free_storage
              )
            : undefined,
      };
    case DeviceKnownDataType.SIMULATOR:
      return {
        subject: t('Simulator'),
        value: data.simulator,
      };
    case DeviceKnownDataType.BOOT_TIME:
      return {
        subject: t('Boot Time'),
        value: data.boot_time,
      };
    case DeviceKnownDataType.TIMEZONE:
      return {
        subject: t('Timezone'),
        value: data.timezone,
      };
    case DeviceKnownDataType.DEVICE_TYPE:
      return {
        subject: t('Device Type'),
        value: data.device_type,
      };
    case DeviceKnownDataType.ARCHS:
      return {
        subject: t('Architectures'),
        value: data.archs,
      };
    case DeviceKnownDataType.BRAND:
      return {
        subject: t('Brand'),
        value: data.brand,
      };
    case DeviceKnownDataType.CHARGING:
      return {
        subject: t('Charging'),
        value: data.charging,
      };
    case DeviceKnownDataType.CONNECTION_TYPE:
      return {
        subject: t('Connection Type'),
        value: data.connection_type,
      };
    case DeviceKnownDataType.ID:
      return {
        subject: t('Id'),
        value: data.id,
      };
    case DeviceKnownDataType.LANGUAGE:
      return {
        subject: t('Language'),
        value: data.language,
      };
    case DeviceKnownDataType.LOW_MEMORY:
      return {
        subject: t('Low Memory'),
        value: data.low_memory,
      };
    case DeviceKnownDataType.MANUFACTURER:
      return {
        subject: t('Manufacturer'),
        value: data.manufacturer,
      };
    case DeviceKnownDataType.ONLINE:
      return {
        subject: t('Online'),
        value: data.online,
      };
    case DeviceKnownDataType.SCREEN_DENSITY:
      return {
        subject: t('Screen density'),
        value: data.screen_density,
      };
    case DeviceKnownDataType.SCREEN_DPI:
      return {
        subject: t('Screen DPI'),
        value: data.screen_dpi,
      };
    case DeviceKnownDataType.SCREEN_HEIGHT_PIXELS:
      return {
        subject: t('Screen height pixels'),
        value: data.screen_height_pixels,
      };
    case DeviceKnownDataType.SCREEN_RESOLUTION:
      return {
        subject: t('Screen resolution'),
        value: data.screen_resolution,
      };
    case DeviceKnownDataType.SCREEN_WIDTH_PIXELS:
      return {
        subject: t('Screen width pixels'),
        value: data.screen_width_pixels,
      };
    default:
      return {
        subject: type,
        value: data[type],
      };
  }
}

export default getDeviceKnownDataDetails;
