// https://github.com/getsentry/relay/blob/24.10.0/relay-event-schema/src/protocol/contexts/gpu.rs#L21

export enum GPUKnownDataType {
  NAME = 'name',
  VERSION = 'version',
  ID = 'id',
  VENDOR_ID = 'vendor_id',
  VENDOR_NAME = 'vendor_name',
  MEMORY_SIZE = 'memory_size',
  API_TYPE = 'api_type',
  MULTI_THREAD_RENDERING = 'multi_threaded_rendering',
  NPOT_SUPPORT = 'npot_support',
  MAX_TEXTURE_SIZE = 'max_texture_size',
  GRAPHICS_SHADER_LEVEL = 'graphics_shader_level',
  SUPPORTS_DRAW_CALL_INSTANCING = 'supports_draw_call_instancing',
  SUPPORTS_RAY_TRACING = 'supports_ray_tracing',
  SUPPORTS_COMPUTE_SHADERS = 'supports_compute_shaders',
  SUPPORTS_GEOMETRY_SHADERS = 'supports_geometry_shaders',
}

export type GPUData = {
  [GPUKnownDataType.ID]: number;
  [GPUKnownDataType.VENDOR_ID]: string;
  [GPUKnownDataType.NAME]?: string;
  [GPUKnownDataType.VERSION]?: string;
  [GPUKnownDataType.VENDOR_NAME]?: string;
  [GPUKnownDataType.MEMORY_SIZE]?: number;
  [GPUKnownDataType.API_TYPE]?: string;
  [GPUKnownDataType.MULTI_THREAD_RENDERING]?: boolean;
  [GPUKnownDataType.NPOT_SUPPORT]?: string;
  [GPUKnownDataType.MAX_TEXTURE_SIZE]?: number;
  [GPUKnownDataType.GRAPHICS_SHADER_LEVEL]?: string;
  [GPUKnownDataType.SUPPORTS_DRAW_CALL_INSTANCING]?: boolean;
  [GPUKnownDataType.SUPPORTS_RAY_TRACING]?: boolean;
  [GPUKnownDataType.SUPPORTS_COMPUTE_SHADERS]?: boolean;
  [GPUKnownDataType.SUPPORTS_GEOMETRY_SHADERS]?: boolean;
};
