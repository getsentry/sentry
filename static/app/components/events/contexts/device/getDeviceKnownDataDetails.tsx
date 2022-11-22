import {DeviceName} from 'sentry/components/deviceName';
import FileSize from 'sentry/components/fileSize';
import {t} from 'sentry/locale';
import {DeviceContext, DeviceContextKeys, Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';

import {getRelativeTimeFromEventDateCreated} from '../utils';

import {formatMemory, formatStorage} from './utils';

export const deviceKnownDataValues = [
  ...Object.keys(DeviceContextKeys),
  // Added two general keys here to namespace the values
  // tracks memory_size, free_memory, usable_memory
  'memory',
  // tracks storage_size, free_storage, external_storage_size, external_free_storage
  'storage',
];

type Output = {
  subject: string;
  value?: React.ReactNode;
};

type Props = {
  data: DeviceContext;
  event: Event;
  type: keyof typeof deviceKnownDataValues;
};

export function getDeviceKnownDataDetails({
  data,
  event,
  type,
}: Props): Output | undefined {
  switch (type) {
    case DeviceContextKeys.NAME:
      return {
        subject: t('Name'),
        value: data.name,
      };
    case DeviceContextKeys.FAMILY:
      return {
        subject: t('Family'),
        value: data.family,
      };
    case DeviceContextKeys.MODEL_ID:
      return {
        subject: t('Model Id'),
        value: data.model_id,
      };
    case DeviceContextKeys.MODEL:
      return {
        subject: t('Model'),
        value:
          typeof data.model === 'string' ? (
            <DeviceName
              value={`${data.model} ${data?.model_id ? `(${data.model_id})` : ''}`}
            />
          ) : undefined,
      };
    case DeviceContextKeys.CPU_DESCRIPTION:
      return {
        subject: t('CPU Description'),
        value: data.cpu_description,
      };
    case DeviceContextKeys.ARCH:
      return {
        subject: t('Architecture'),
        value: data.arch,
      };
    case DeviceContextKeys.BATTERY_LEVEL:
      return {
        subject: t('Battery Level'),
        value: defined(data.battery_level) ? `${data.battery_level}%` : undefined,
      };
    case DeviceContextKeys.BATTERY_STATUS:
      return {
        subject: t('Battery Status'),
        value: data.battery_status,
      };
    case DeviceContextKeys.ORIENTATION:
      return {
        subject: t('Orientation'),
        value: data.orientation,
      };
    case 'memory':
      const {memory_size, free_memory, usable_memory} = data;
      return {
        subject: t('Memory'),
        value:
          memory_size && free_memory && usable_memory
            ? formatMemory(memory_size, free_memory, usable_memory)
            : undefined,
      };
    case 'storage':
      const {storage_size, free_storage, external_storage_size, external_free_storage} =
        data;
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
    case DeviceContextKeys.SIMULATOR:
      return {
        subject: t('Simulator'),
        value: data.simulator,
      };
    case DeviceContextKeys.BOOT_TIME:
      return {
        subject: t('Boot Time'),
        value: getRelativeTimeFromEventDateCreated(
          event.dateCreated ? event.dateCreated : event.dateReceived,
          data.boot_time
        ),
      };
    case DeviceContextKeys.DEVICE_TYPE:
      return {
        subject: t('Device Type'),
        value: data.device_type,
      };
    case DeviceContextKeys.BRAND:
      return {
        subject: t('Brand'),
        value: data.brand,
      };
    case DeviceContextKeys.CHARGING:
      return {
        subject: t('Charging'),
        value: data.charging,
      };
    case DeviceContextKeys.LOW_MEMORY:
      return {
        subject: t('Low Memory'),
        value: data.low_memory,
      };
    case DeviceContextKeys.FREE_MEMORY:
      return {
        subject: t('Free Memory'),
        value: data.free_memory ? <FileSize bytes={data.free_memory} /> : undefined,
      };
    case DeviceContextKeys.MEMORY_SIZE:
      return {
        subject: t('Memory Size'),
        value: data.memory_size ? <FileSize bytes={data.memory_size} /> : undefined,
      };
    case DeviceContextKeys.USABLE_MEMORY:
      return {
        subject: t('Usable Memory'),
        value: data.usable_memory ? <FileSize bytes={data.usable_memory} /> : undefined,
      };
    case DeviceContextKeys.MANUFACTURER:
      return {
        subject: t('Manufacturer'),
        value: data.manufacturer,
      };
    case DeviceContextKeys.ONLINE:
      return {
        subject: t('Online'),
        value: data.online,
      };
    case DeviceContextKeys.SCREEN_DENSITY:
      return {
        subject: t('Screen Density'),
        value: data.screen_density,
      };
    case DeviceContextKeys.SCREEN_DPI:
      return {
        subject: t('Screen DPI'),
        value: data.screen_dpi,
      };
    case DeviceContextKeys.SCREEN_HEIGHT_PIXELS:
      return {
        subject: t('Screen Height Pixels'),
        value: data.screen_height_pixels,
      };
    case DeviceContextKeys.SCREEN_RESOLUTION:
      return {
        subject: t('Screen Resolution'),
        value: data.screen_resolution,
      };
    case DeviceContextKeys.SCREEN_WIDTH_PIXELS:
      return {
        subject: t('Screen Width Pixels'),
        value: data.screen_width_pixels,
      };
    default:
      return undefined;
  }
}
