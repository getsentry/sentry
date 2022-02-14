export enum DeviceKnownDataType {
  ARCH = 'arch',
  ARCHS = 'archs',
  BATTERY_LEVEL = 'battery_level',
  BATTERY_STATUS = 'battery_status',
  BRAND = 'brand',
  BOOT_TIME = 'boot_time',
  CONNECTION_TYPE = 'connection_type',
  CHARGING = 'charging',
  CPU_DESCRIPTION = 'cpu_description',
  DEVICE_TYPE = 'device_type',
  EXTERNAL_STORAGE_SIZE = 'external_storage_size',
  EXTERNAL_FREE_STORAGE = 'external_free_storage',
  FAMILY = 'family',
  FREE_STORAGE = 'free_storage',
  FREE_MEMORY = 'free_memory',
  ID = 'id',
  LANGUAGE = 'language',
  LOW_MEMORY = 'low_memory',
  MANUFACTURER = 'manufacturer',
  MODEL = 'model',
  MODEL_ID = 'model_id',
  MEMORY = 'memory',
  MEMORY_SIZE = 'memory_size',
  NAME = 'name',
  ONLINE = 'online',
  ORIENTATION = 'orientation',
  RENDERED_MODEL = 'renderedModel',
  SIMULATOR = 'simulator',
  SCREEN_DENSITY = 'screen_density',
  SCREEN_DPI = 'screen_dpi',
  SCREEN_HEIGHT_PIXELS = 'screen_height_pixels',
  SCREEN_RESOLUTION = 'screen_resolution',
  SCREEN_WIDTH_PIXELS = 'screen_width_pixels',
  STORAGE_SIZE = 'storage_size',
  STORAGE = 'storage',
  TIMEZONE = 'timezone',
  USABLE_MEMORY = 'usable_memory',
}

// TODO(ts): add correct types
export type DeviceData = {
  device_type: string;
  name: string;
  arch?: string;
  archs?: Array<string>;
  battery_level?: number;
  battery_status?: string;
  boot_time?: string;
  brand?: string;
  charging?: boolean;
  connection_type?: any;
  cpu_description?: string;
  external_free_storage?: number;
  external_storage_size?: number;
  family?: string;
  free_memory?: number;
  free_storage?: number;
  id?: any;
  language?: any;
  low_memory?: boolean;
  manufacturer?: string;
  memory?: any;
  memory_size?: number;
  model?: string;
  model_id?: string;
  online?: boolean;
  orientation?: string;
  renderedModel?: any;
  screen_density?: number;
  screen_dpi?: number;
  screen_height_pixels?: number;
  screen_resolution?: string;
  screen_width_pixels?: number;
  simulator?: boolean;
  storage?: any;
  storage_size?: number;
  timezone?: string;
  type?: string;
  usable_memory?: number;
};
