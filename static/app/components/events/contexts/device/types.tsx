export enum DeviceKnownDataType {
  ARCH = 'arch',
  ARCHS = 'archs',
  BATTERY_LEVEL = 'battery_level',
  BATTERY_STATUS = 'baterry_status',
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
