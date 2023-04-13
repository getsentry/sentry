import {DeviceName} from 'sentry/components/deviceName';
import FileSize from 'sentry/components/fileSize';
import {t} from 'sentry/locale';
import {DeviceContext, DeviceContextKey, Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';

import {getRelativeTimeFromEventDateCreated} from '../utils';

import {formatMemory, formatStorage} from './utils';

export const deviceKnownDataValues = [
  ...Object.values(DeviceContextKey),
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
  type: (typeof deviceKnownDataValues)[number];
};

export function getDeviceKnownDataDetails({
  data,
  event,
  type,
}: Props): Output | undefined {
  switch (type) {
    case DeviceContextKey.NAME:
      return {
        subject: t('Name'),
        value: data.name,
      };
    case DeviceContextKey.FAMILY:
      return {
        subject: t('Family'),
        value: data.family,
      };
    case DeviceContextKey.MODEL_ID:
      return {
        subject: t('Model Id'),
        value: data.model_id,
      };
    case DeviceContextKey.MODEL:
      return {
        subject: t('Model'),
        value:
          typeof data.model === 'string' ? (
            <DeviceName
              value={`${data.model} ${data?.model_id ? `(${data.model_id})` : ''}`}
            />
          ) : undefined,
      };
    case DeviceContextKey.CPU_DESCRIPTION:
      return {
        subject: t('CPU Description'),
        value: data.cpu_description,
      };
    case DeviceContextKey.ARCH:
      return {
        subject: t('Architecture'),
        value: data.arch,
      };
    case DeviceContextKey.BATTERY_LEVEL:
      return {
        subject: t('Battery Level'),
        value: defined(data.battery_level) ? `${data.battery_level}%` : undefined,
      };
    case DeviceContextKey.BATTERY_STATUS:
      return {
        subject: t('Battery Status'),
        value: data.battery_status,
      };
    case DeviceContextKey.ORIENTATION:
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
    case DeviceContextKey.FREE_STORAGE: {
      return {
        subject: t('Free Storage'),
        value: data.free_storage ? <FileSize bytes={data.free_storage} /> : undefined,
      };
    }
    case DeviceContextKey.STORAGE_SIZE: {
      return {
        subject: t('Storage Size'),
        value: data.storage_size ? <FileSize bytes={data.storage_size} /> : undefined,
      };
    }
    case DeviceContextKey.EXTERNAL_STORAGE_SIZE: {
      return {
        subject: t('External Storage Size'),
        value: data.external_storage_size ? (
          <FileSize bytes={data.external_storage_size} />
        ) : undefined,
      };
    }
    case DeviceContextKey.EXTERNAL_FREE_STORAGE: {
      return {
        subject: t('External Free Storage'),
        value: data.external_free_storage ? (
          <FileSize bytes={data.external_free_storage} />
        ) : undefined,
      };
    }
    case DeviceContextKey.SIMULATOR:
      return {
        subject: t('Simulator'),
        value: data.simulator,
      };
    case DeviceContextKey.BOOT_TIME:
      return {
        subject: t('Boot Time'),
        value: getRelativeTimeFromEventDateCreated(
          event.dateCreated ? event.dateCreated : event.dateReceived,
          data.boot_time
        ),
      };
    case DeviceContextKey.DEVICE_TYPE:
      return {
        subject: t('Device Type'),
        value: data.device_type,
      };
    case DeviceContextKey.BRAND:
      return {
        subject: t('Brand'),
        value: data.brand,
      };
    case DeviceContextKey.CHARGING:
      return {
        subject: t('Charging'),
        value: data.charging,
      };
    case DeviceContextKey.LOW_MEMORY:
      return {
        subject: t('Low Memory'),
        value: data.low_memory,
      };
    case DeviceContextKey.FREE_MEMORY:
      return {
        subject: t('Free Memory'),
        value: data.free_memory ? <FileSize bytes={data.free_memory} /> : undefined,
      };
    case DeviceContextKey.MEMORY_SIZE:
      return {
        subject: t('Memory Size'),
        value: data.memory_size ? <FileSize bytes={data.memory_size} /> : undefined,
      };
    case DeviceContextKey.USABLE_MEMORY:
      return {
        subject: t('Usable Memory'),
        value: data.usable_memory ? <FileSize bytes={data.usable_memory} /> : undefined,
      };
    case DeviceContextKey.MANUFACTURER:
      return {
        subject: t('Manufacturer'),
        value: data.manufacturer,
      };
    case DeviceContextKey.ONLINE:
      return {
        subject: t('Online'),
        value: data.online,
      };
    case DeviceContextKey.SCREEN_DENSITY:
      return {
        subject: t('Screen Density'),
        value: data.screen_density,
      };
    case DeviceContextKey.SCREEN_DPI:
      return {
        subject: t('Screen DPI'),
        value: data.screen_dpi,
      };
    case DeviceContextKey.SCREEN_HEIGHT_PIXELS:
      return {
        subject: t('Screen Height Pixels'),
        value: data.screen_height_pixels,
      };
    case DeviceContextKey.SCREEN_RESOLUTION:
      return {
        subject: t('Screen Resolution'),
        value: data.screen_resolution,
      };
    case DeviceContextKey.SCREEN_WIDTH_PIXELS:
      return {
        subject: t('Screen Width Pixels'),
        value: data.screen_width_pixels,
      };
    default:
      return undefined;
  }
}
