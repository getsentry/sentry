import {DeviceContext, DeviceContextKey} from 'sentry/types';
import {defined, formatBytesBase2} from 'sentry/utils';

export function formatMemory(
  memory_size: number,
  free_memory: number,
  usable_memory: number
) {
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

export function formatStorage(
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

// List of common display resolutions taken from the source: https://en.wikipedia.org/wiki/Display_resolution#Common_display_resolutions
export const commonDisplayResolutions = {
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

export function getInferredData(data: DeviceContext) {
  const screenResolution = data[DeviceContextKey.SCREEN_RESOLUTION];
  const screenWidth = data[DeviceContextKey.SCREEN_WIDTH_PIXELS];
  const screenHeight = data[DeviceContextKey.SCREEN_HEIGHT_PIXELS];

  if (screenResolution) {
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
