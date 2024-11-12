import {getContextKeys} from 'sentry/components/events/contexts/utils';
import {t} from 'sentry/locale';
import type {KeyValueListData} from 'sentry/types/group';
import {formatBytesBase2} from 'sentry/utils/bytes/formatBytesBase2';

// https://github.com/getsentry/relay/blob/24.10.0/relay-event-schema/src/protocol/contexts/gpu.rs#L21
enum GPUContextKeys {
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

export type GPUContext = {
  // Any custom keys users may set
  [key: string]: any;
  [GPUContextKeys.ID]: number;
  [GPUContextKeys.VENDOR_ID]: string;
  [GPUContextKeys.NAME]?: string;
  [GPUContextKeys.VERSION]?: string;
  [GPUContextKeys.VENDOR_NAME]?: string;
  [GPUContextKeys.MEMORY_SIZE]?: number;
  [GPUContextKeys.API_TYPE]?: string;
  [GPUContextKeys.MULTI_THREAD_RENDERING]?: boolean;
  [GPUContextKeys.NPOT_SUPPORT]?: string;
  [GPUContextKeys.MAX_TEXTURE_SIZE]?: number;
  [GPUContextKeys.GRAPHICS_SHADER_LEVEL]?: string;
  [GPUContextKeys.SUPPORTS_DRAW_CALL_INSTANCING]?: boolean;
  [GPUContextKeys.SUPPORTS_RAY_TRACING]?: boolean;
  [GPUContextKeys.SUPPORTS_COMPUTE_SHADERS]?: boolean;
  [GPUContextKeys.SUPPORTS_GEOMETRY_SHADERS]?: boolean;
};

const MEGABYTE_IN_BYTES = 1048576;

function formatMemory(memory_size: number) {
  if (!Number.isInteger(memory_size) || memory_size <= 0) {
    return null;
  }

  // 'usable_memory' is in defined in MB
  return formatBytesBase2(memory_size * MEGABYTE_IN_BYTES);
}

export function getGPUContextData({
  data,
  meta,
}: {
  data: GPUContext;
  meta?: Record<keyof GPUContext, any>;
}): KeyValueListData {
  return getContextKeys(data).map(ctxKey => {
    switch (ctxKey) {
      case GPUContextKeys.NAME:
        return {
          key: ctxKey,
          subject: t('Name'),
          value: data.name,
        };
      case GPUContextKeys.VERSION:
        return {
          key: ctxKey,
          subject: t('Version'),
          value: data.version,
        };
      case GPUContextKeys.ID:
        return {
          key: ctxKey,
          subject: t('GPU ID'),
          value: data.id,
        };
      case GPUContextKeys.VENDOR_ID:
        return {
          key: ctxKey,
          subject: t('Vendor ID'),
          value: data.vendor_id,
        };
      case GPUContextKeys.VENDOR_NAME:
        return {
          key: ctxKey,
          subject: t('Vendor Name'),
          value: data.vendor_name,
        };
      case GPUContextKeys.MEMORY_SIZE:
        return {
          key: ctxKey,
          subject: t('Memory'),
          value: data.memory_size ? formatMemory(data.memory_size) : undefined,
        };
      case GPUContextKeys.API_TYPE:
        return {
          key: ctxKey,
          subject: t('API Type'),
          value: data.api_type,
        };
      case GPUContextKeys.MULTI_THREAD_RENDERING:
        return {
          key: ctxKey,
          subject: t('Multi-Thread Rendering'),
          value: data.multi_threaded_rendering,
        };
      case GPUContextKeys.NPOT_SUPPORT:
        return {
          key: ctxKey,
          subject: t('NPOT Support'),
          value: data.npot_support,
        };
      case GPUContextKeys.MAX_TEXTURE_SIZE:
        return {
          key: ctxKey,
          subject: t('Max Texture Size'),
          value: data.max_texture_size,
        };
      case GPUContextKeys.GRAPHICS_SHADER_LEVEL:
        return {
          key: ctxKey,
          subject: t('Approx. Shader Capability'),
          value: data.graphics_shader_level,
        };
      case GPUContextKeys.SUPPORTS_DRAW_CALL_INSTANCING:
        return {
          key: ctxKey,
          subject: t('Supports Draw Call Instancing'),
          value: data.supports_draw_call_instancing,
        };
      case GPUContextKeys.SUPPORTS_RAY_TRACING:
        return {
          key: ctxKey,
          subject: t('Supports Ray Tracing'),
          value: data.supports_ray_tracing,
        };
      case GPUContextKeys.SUPPORTS_COMPUTE_SHADERS:
        return {
          key: ctxKey,
          subject: t('Supports Compute Shaders'),
          value: data.supports_compute_shaders,
        };
      case GPUContextKeys.SUPPORTS_GEOMETRY_SHADERS:
        return {
          key: ctxKey,
          subject: t('Supports Geometry Shaders'),
          value: data.supports_geometry_shaders,
        };
      default:
        return {
          key: ctxKey,
          subject: ctxKey,
          value: data[ctxKey],
          meta: meta?.[ctxKey]?.[''],
        };
    }
  });
}
