export enum GPUKnownDataType {
  ID = 'id',
  NAME = 'name',
  VERSION = 'version',
  VENDOR_NAME = 'vendor_name',
  VENDOR_ID = 'vendor_id',
  MEMORY = 'memory',
  NPOT_SUPPORT = 'npot_support',
  MULTI_THREAD_RENDERING = 'multi_threaded_rendering',
  API_TYPE = 'api_type',
}

export type GPUData = {
  id: number;
  vendor_id: number;
  name?: string;
  version?: string;
  vendor_name?: string;
  memory?: number;
  memory_size?: number;
  npot_support?: string;
  multi_threaded_rendering?: boolean;
  api_type?: string;
};
