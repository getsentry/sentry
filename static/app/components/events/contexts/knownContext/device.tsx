import {DeviceName} from 'sentry/components/deviceName';
import {
  getContextKeys,
  getRelativeTimeFromEventDateCreated,
} from 'sentry/components/events/contexts/utils';
import FileSize from 'sentry/components/fileSize';
import {t} from 'sentry/locale';
import {type DeviceContext, DeviceContextKey, type Event} from 'sentry/types/event';
import type {KeyValueListData} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import {formatBytesBase2} from 'sentry/utils/bytes/formatBytesBase2';

function formatMemory(memory_size: number, free_memory: number, usable_memory: number) {
  if (
    !Number.isInteger(memory_size) ||
    memory_size <= 0 ||
    !Number.isInteger(free_memory) ||
    free_memory <= 0
  ) {
    return null;
  }

  let memory = `Total: ${formatBytesBase2(memory_size)} / Free: ${formatBytesBase2(
    free_memory
  )}`;
  if (Number.isInteger(usable_memory) && usable_memory > 0) {
    memory = `${memory} / Usable: ${formatBytesBase2(usable_memory)}`;
  }

  return memory;
}

function formatStorage(
  storage_size: number,
  free_storage: number,
  external_storage_size: number,
  external_free_storage: number
) {
  if (!Number.isInteger(storage_size) || storage_size <= 0) {
    return null;
  }

  let storage = `Total: ${formatBytesBase2(storage_size)}`;
  if (Number.isInteger(free_storage) && free_storage > 0) {
    storage = `${storage} / Free: ${formatBytesBase2(free_storage)}`;
  }

  if (
    Number.isInteger(external_storage_size) &&
    external_storage_size > 0 &&
    Number.isInteger(external_free_storage) &&
    external_free_storage > 0
  ) {
    storage = `${storage} (External Total: ${formatBytesBase2(
      external_storage_size
    )} / Free: ${formatBytesBase2(external_free_storage)})`;
  }

  return storage;
}

const commonDisplayResolutions = {
  '640x360': 'nHD',
  '800x600': 'SVGA',
  '1024x768': 'XGA',
  '1280x720': 'WXGA',
  '1280x800': 'WXGA',
  '1280x1024': 'SXGA',
  '1360x768': 'HD',
  '1366x768': 'HD',
  '1440x900': 'WXGA+',
  '1536x864': 'NA',
  '1600x900': 'HD+',
  '1680x1050': 'WSXGA+',
  '1920x1080': 'FHD',
  '1920x1200': 'WUXGA',
  '2048x1152': 'QWXGA',
  '2560x1080': 'N/A',
  '2560x1440': 'QHD',
  '3440x1440': 'N/A',
  '3840x2160': '4K UHD',
};

function getInferredData(data: DeviceContext) {
  const screenResolution = data[DeviceContextKey.SCREEN_RESOLUTION];
  const screenWidth = data[DeviceContextKey.SCREEN_WIDTH_PIXELS];
  const screenHeight = data[DeviceContextKey.SCREEN_HEIGHT_PIXELS];

  if (screenResolution) {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    const displayResolutionDescription = commonDisplayResolutions[screenResolution];

    const commonData = {
      ...data,
      [DeviceContextKey.SCREEN_RESOLUTION]: displayResolutionDescription
        ? `${screenResolution} (${displayResolutionDescription})`
        : screenResolution,
    };

    if (!defined(screenWidth) && !defined(screenHeight)) {
      const [width, height] = screenResolution.split('x');

      if (width && height) {
        return {
          ...commonData,
          [DeviceContextKey.SCREEN_WIDTH_PIXELS]: Number(width),
          [DeviceContextKey.SCREEN_HEIGHT_PIXELS]: Number(height),
        };
      }
    }

    return commonData;
  }

  if (defined(screenWidth) && defined(screenHeight)) {
    const displayResolution = `${screenWidth}x${screenHeight}`;
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    const displayResolutionDescription = commonDisplayResolutions[displayResolution];

    return {
      ...data,
      [DeviceContextKey.SCREEN_RESOLUTION]: displayResolutionDescription
        ? `${displayResolution} (${displayResolutionDescription})`
        : displayResolution,
    };
  }

  return data;
}

export function getDeviceContextData({
  data,
  event,
  meta,
}: {
  data: DeviceContext;
  event: Event;
  meta?: Record<keyof DeviceContext, any>;
}): KeyValueListData {
  return getContextKeys({data: getInferredData(data)}).map(ctxKey => {
    switch (ctxKey) {
      case DeviceContextKey.NAME:
        return {
          key: ctxKey,
          subject: t('Name'),
          value: data.name,
        };
      case DeviceContextKey.FAMILY:
        return {
          key: ctxKey,
          subject: t('Family'),
          value: data.family,
        };
      case DeviceContextKey.MODEL_ID:
        return {
          key: ctxKey,
          subject: t('Model Id'),
          value: data.model_id,
        };
      case DeviceContextKey.MODEL:
        return {
          key: ctxKey,
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
          key: ctxKey,
          subject: t('CPU Description'),
          value: data.cpu_description,
        };
      case DeviceContextKey.ARCH:
        return {
          key: ctxKey,
          subject: t('Architecture'),
          value: data.arch,
        };
      case DeviceContextKey.BATTERY_LEVEL:
        return {
          key: ctxKey,
          subject: t('Battery Level'),
          value: defined(data.battery_level) ? `${data.battery_level}%` : undefined,
        };
      case DeviceContextKey.BATTERY_STATUS:
        return {
          key: ctxKey,
          subject: t('Battery Status'),
          value: data.battery_status,
        };
      case DeviceContextKey.BATTERY_TEMPERATURE:
        return {
          key: ctxKey,
          subject: t('Battery Temperature (°C)'),
          value: data.battery_temperature,
        };
      case DeviceContextKey.ORIENTATION:
        return {
          key: ctxKey,
          subject: t('Orientation'),
          value: data.orientation,
        };
      case 'memory':
        const {memory_size, free_memory, usable_memory} = data;
        return {
          key: ctxKey,
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
          key: ctxKey,
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
          key: ctxKey,
          subject: t('Free Storage'),
          value: data.free_storage ? <FileSize bytes={data.free_storage} /> : undefined,
        };
      }
      case DeviceContextKey.STORAGE_SIZE: {
        return {
          key: ctxKey,
          subject: t('Storage Size'),
          value: data.storage_size ? <FileSize bytes={data.storage_size} /> : undefined,
        };
      }
      case DeviceContextKey.EXTERNAL_STORAGE_SIZE: {
        return {
          key: ctxKey,
          subject: t('External Storage Size'),
          value: data.external_storage_size ? (
            <FileSize bytes={data.external_storage_size} />
          ) : undefined,
        };
      }
      case DeviceContextKey.EXTERNAL_FREE_STORAGE: {
        return {
          key: ctxKey,
          subject: t('External Free Storage'),
          value: data.external_free_storage ? (
            <FileSize bytes={data.external_free_storage} />
          ) : undefined,
        };
      }
      case DeviceContextKey.SIMULATOR:
        return {
          key: ctxKey,
          subject: t('Simulator'),
          value: data.simulator,
        };
      case DeviceContextKey.BOOT_TIME:
        return {
          key: ctxKey,
          subject: t('Boot Time'),
          value: getRelativeTimeFromEventDateCreated(
            event.dateCreated ? event.dateCreated : event.dateReceived,
            data.boot_time
          ),
        };
      case DeviceContextKey.DEVICE_TYPE:
        return {
          key: ctxKey,
          subject: t('Device Type'),
          value: data.device_type,
        };
      case DeviceContextKey.BRAND:
        return {
          key: ctxKey,
          subject: t('Brand'),
          value: data.brand,
        };
      case DeviceContextKey.CHARGING:
        return {
          key: ctxKey,
          subject: t('Charging'),
          value: data.charging,
        };
      case DeviceContextKey.LOW_MEMORY:
        return {
          key: ctxKey,
          subject: t('Low Memory'),
          value: data.low_memory,
        };
      case DeviceContextKey.FREE_MEMORY:
        return {
          key: ctxKey,
          subject: t('Free Memory'),
          value: data.free_memory ? <FileSize bytes={data.free_memory} /> : undefined,
        };
      case DeviceContextKey.MEMORY_SIZE:
        return {
          key: ctxKey,
          subject: t('Memory Size'),
          value: data.memory_size ? <FileSize bytes={data.memory_size} /> : undefined,
        };
      case DeviceContextKey.USABLE_MEMORY:
        return {
          key: ctxKey,
          subject: t('Usable Memory'),
          value: data.usable_memory ? <FileSize bytes={data.usable_memory} /> : undefined,
        };
      case DeviceContextKey.MANUFACTURER:
        return {
          key: ctxKey,
          subject: t('Manufacturer'),
          value: data.manufacturer,
        };
      case DeviceContextKey.ONLINE:
        return {
          key: ctxKey,
          subject: t('Online'),
          value: data.online,
        };
      case DeviceContextKey.SCREEN_DENSITY:
        return {
          key: ctxKey,
          subject: t('Screen Density'),
          value: data.screen_density,
        };
      case DeviceContextKey.SCREEN_DPI:
        return {
          key: ctxKey,
          subject: t('Screen DPI'),
          value: data.screen_dpi,
        };
      case DeviceContextKey.SCREEN_HEIGHT_PIXELS:
        return {
          key: ctxKey,
          subject: t('Screen Height Pixels'),
          value: data.screen_height_pixels,
        };
      case DeviceContextKey.SCREEN_RESOLUTION:
        return {
          key: ctxKey,
          subject: t('Screen Resolution'),
          value: data.screen_resolution,
        };
      case DeviceContextKey.SCREEN_WIDTH_PIXELS:
        return {
          key: ctxKey,
          subject: t('Screen Width Pixels'),
          value: data.screen_width_pixels,
        };

      default:
        return {
          key: ctxKey,
          subject: ctxKey,
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          value: data[ctxKey],
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          meta: meta?.[ctxKey]?.[''],
        };
    }
  });
}
