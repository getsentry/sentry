export enum DeviceKnownDataType {
  NAME = 'name',
  FAMILY = 'family',
  RENDERED_MODEL = 'renderedModel',
  MODEL = 'model',
  MODEL_ID = 'model_id',
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
