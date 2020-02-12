import React from 'react';
import {t} from 'app/locale';
import {defined} from 'app/utils';
import DeviceName from 'app/components/deviceName';

import formatMemory from './formatMemory';
import formatStorage from './formatStorage';

export enum DeviceKnownDataDetailsType {
  NAME = 'name',
  FAMILY = 'family',
  RENDERED_MODEL = 'renderedModel',
  CPU_DESCRIPTION = 'cpu_description',
  ARCH = 'arch',
  BATTERY_LEVEL = 'battery_level',
  BATTERY_STATUS = 'baterry_status',
  ORIENTATION = 'orientation',
  MEMORY = 'memory',
  STORAGE = 'storage',
  SIMULATOR = 'simulator',
  BOOT_TIME = 'boot_time',
  TIMEZONE = 'timezone',
  DEVICE_TYPE = 'device_type',
  ARCHS = 'archs',
  BRAND = 'brand',
  CHARGING = 'charging',
  CONNECTION_TYPE = 'connection_type',
  ID = 'id',
  LANGUAGE = 'language',
  LOW_MEMORY = 'low_memory',
  MANUFACTURER = 'manufacturer',
  ONLINE = 'online',
  SCREEN_DENSITY = 'screen_density',
  SCREEN_DPI = 'screen_dpi',
  SCREEN_HEIGHT_PIXELS = 'screen_height_pixels',
  SCREEN_RESOLUTION = 'screen_resolution',
  SCREEN_WIDTH_PIXELS = 'screen_width_pixels',
}

// TODO(ts): add correct types
export type DeviceData = {
  name: string;
  family?: string;
  cpu_description?: string;
  arch?: string;
  type?: string;
  battery_level?: number;
  battery_status?: string;
  orientation?: string;
  simulator?: boolean;
  boot_time?: string;
  timezone?: string;
  device_type: string;
  archs?: Array<string>;
  brand?: string;
  charging?: boolean;
  low_memory?: boolean;
  manufacturer?: string;
  online?: boolean;
  screen_density?: number;
  screen_dpi?: number;
  screen_height_pixels?: string;
  screen_resolution?: string;
  screen_width_pixels?: number;
  memory_size?: number;
  free_memory?: number;
  usable_memory?: number;
  storage_size?: number;
  free_storage?: number;
  external_storage_size?: number;
  external_free_storage?: number;
  model?: string;
  model_id?: string;
  id?: any;
  language?: any;
  connection_type?: any;
  memory?: any;
  storage?: any;
  renderedModel?: any;
};

type Output = {
  subject: string;
  value: string | null | React.ReactNode;
};

function getDeviceKnownDataDetails(
  data: DeviceData,
  type: DeviceKnownDataDetailsType
): Output | undefined {
  switch (type) {
    case DeviceKnownDataDetailsType.NAME:
      return {
        subject: t('Name'),
        value: data.name,
      };
    case DeviceKnownDataDetailsType.FAMILY:
      return {
        subject: t('Family'),
        value: data.family,
      };
    case DeviceKnownDataDetailsType.RENDERED_MODEL:
      return {
        subject: t('Model'),
        value:
          typeof data.model === 'string' ? (
            <DeviceName>
              {`${data.model} ${data.model_id ? `(${data.model_id})` : ''}`}
            </DeviceName>
          ) : null,
      };
    case DeviceKnownDataDetailsType.CPU_DESCRIPTION:
      return {
        subject: t('CPU Description'),
        value: data.cpu_description,
      };
    case DeviceKnownDataDetailsType.ARCH:
      return {
        subject: t('Architecture'),
        value: data.arch,
      };
    case DeviceKnownDataDetailsType.BATTERY_LEVEL:
      return {
        subject: t('Battery Level'),
        value: defined(data.battery_level) ? `${data.battery_level}%` : null,
      };
    case DeviceKnownDataDetailsType.BATTERY_STATUS:
      return {
        subject: t('Battery Status'),
        value: data.battery_status,
      };
    case DeviceKnownDataDetailsType.ORIENTATION:
      return {
        subject: t('Orientation'),
        value: data.orientation,
      };
    case DeviceKnownDataDetailsType.MEMORY:
      const {memory_size, free_memory, usable_memory} = data;
      return {
        subject: t('Memory'),
        value:
          memory_size && free_memory && usable_memory
            ? formatMemory(memory_size, free_memory, usable_memory)
            : null,
      };
    case DeviceKnownDataDetailsType.STORAGE:
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
            : null,
      };
    case DeviceKnownDataDetailsType.SIMULATOR:
      return {
        subject: t('Simulator'),
        value: data.simulator,
      };
    case DeviceKnownDataDetailsType.BOOT_TIME:
      return {
        subject: t('Boot Time'),
        value: data.boot_time,
      };
    case DeviceKnownDataDetailsType.TIMEZONE:
      return {
        subject: t('Timezone'),
        value: data.timezone,
      };
    case DeviceKnownDataDetailsType.DEVICE_TYPE:
      return {
        subject: t('Device Type'),
        value: data.device_type,
      };
    case DeviceKnownDataDetailsType.ARCHS:
      return {
        subject: t('Architectures'),
        value: data.archs,
      };
    case DeviceKnownDataDetailsType.BRAND:
      return {
        subject: t('Brand'),
        value: data.brand,
      };
    case DeviceKnownDataDetailsType.CHARGING:
      return {
        subject: t('Charging'),
        value: data.charging,
      };
    case DeviceKnownDataDetailsType.CONNECTION_TYPE:
      return {
        subject: t('Connection Type'),
        value: data.connection_type,
      };
    case DeviceKnownDataDetailsType.ID:
      return {
        subject: t('Id'),
        value: data.id,
      };
    case DeviceKnownDataDetailsType.LANGUAGE:
      return {
        subject: t('Language'),
        value: data.language,
      };
    case DeviceKnownDataDetailsType.LOW_MEMORY:
      return {
        subject: t('Low Memory'),
        value: data.low_memory,
      };
    case DeviceKnownDataDetailsType.MANUFACTURER:
      return {
        subject: t('Manufacturer'),
        value: data.manufacturer,
      };
    case DeviceKnownDataDetailsType.ONLINE:
      return {
        subject: t('Online'),
        value: data.online,
      };
    case DeviceKnownDataDetailsType.SCREEN_DENSITY:
      return {
        subject: t('Screen density'),
        value: data.screen_density,
      };
    case DeviceKnownDataDetailsType.SCREEN_DPI:
      return {
        subject: t('Screen DPI'),
        value: data.screen_dpi,
      };
    case DeviceKnownDataDetailsType.SCREEN_HEIGHT_PIXELS:
      return {
        subject: t('Screen height pixels'),
        value: data.screen_height_pixels,
      };
    case DeviceKnownDataDetailsType.SCREEN_RESOLUTION:
      return {
        subject: t('Screen resolution'),
        value: data.screen_resolution,
      };
    case DeviceKnownDataDetailsType.SCREEN_WIDTH_PIXELS:
      return {
        subject: t('Screen width pixels'),
        value: data.screen_width_pixels,
      };
    default:
      return undefined;
  }
}

export default getDeviceKnownDataDetails;
