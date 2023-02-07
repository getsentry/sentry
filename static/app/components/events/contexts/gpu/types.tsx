export enum GPUKnownDataType {
  ID = 'id',
  NAME = 'name',
  VERSION = 'version',
  VENDOR_NAME = 'vendor_name',
  VENDOR_ID = 'vendor_id',
  MEMORY_SIZE = 'memory_size',
  NPOT_SUPPORT = 'npot_support',
  MULTI_THREAD_RENDERING = 'multi_threaded_rendering',
  API_TYPE = 'api_type',
}

export type GPUData = {
  id: number;
  vendor_id: number;
  api_type?: string;
  memory?: number;
  memory_size?: number;
  multi_threaded_rendering?: boolean;
  name?: string;
  npot_support?: string;
  vendor_name?: string;
  version?: string;
};
