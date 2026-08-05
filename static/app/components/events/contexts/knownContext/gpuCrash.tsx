import {getContextKeys} from 'sentry/components/events/contexts/utils';
import {t} from 'sentry/locale';
import type {KeyValueListData} from 'sentry/types/group';

// Fields emitted by `_produce_gpu_occurrence` in
// src/sentry/lang/native/processing.py when teapot decodes a GPU crash.
enum GPUCrashContextKeys {
  STATUS = 'status',
  HANDLER = 'handler',
  SDK_VERSION = 'sdk_version',
  DECODE_TIME_MS = 'decode_time_ms',
  FAULT_TYPE = 'fault_type',
  FAULT_DESCRIPTION = 'fault_description',
  FAULT_CODE = 'fault_code',
  VIRTUAL_ADDRESS = 'virtual_address',
  ACCESS_TYPE = 'access_type',
  DEVICE_NAME = 'device_name',
  DEVICE_STATUS = 'device_status',
  DRIVER_VERSION = 'driver_version',
  GRAPHICS_API = 'graphics_api',
  OS_VERSION = 'os_version',
  APPLICATION_NAME = 'application_name',
  APPLICATION_VERSION = 'application_version',
  ENGINE_RESET = 'engine_reset',
  ADAPTER_RESET = 'adapter_reset',
  SHADER_HASH = 'shader_hash',
  SHADER_NAME = 'shader_name',
  SHADER_TYPE = 'shader_type',
  SHADER_DEBUG_INFO_UID = 'shader_debug_info_uid',
  PC_ADDRESS = 'pc_address',
  MISSING_DIF_COUNT = 'missing_dif_count',
}

export interface GPUCrashContext {
  // Any custom keys users may set
  [key: string]: any;
  [GPUCrashContextKeys.ACCESS_TYPE]?: string;
  [GPUCrashContextKeys.ADAPTER_RESET]?: boolean;
  [GPUCrashContextKeys.APPLICATION_NAME]?: string;
  [GPUCrashContextKeys.APPLICATION_VERSION]?: string;
  [GPUCrashContextKeys.DECODE_TIME_MS]?: number;
  [GPUCrashContextKeys.DEVICE_NAME]?: string;
  [GPUCrashContextKeys.DEVICE_STATUS]?: string;
  [GPUCrashContextKeys.DRIVER_VERSION]?: string;
  [GPUCrashContextKeys.ENGINE_RESET]?: boolean;
  [GPUCrashContextKeys.FAULT_CODE]?: string;
  [GPUCrashContextKeys.FAULT_DESCRIPTION]?: string;
  [GPUCrashContextKeys.FAULT_TYPE]?: string;
  [GPUCrashContextKeys.GRAPHICS_API]?: string;
  [GPUCrashContextKeys.HANDLER]?: string;
  [GPUCrashContextKeys.MISSING_DIF_COUNT]?: number;
  [GPUCrashContextKeys.OS_VERSION]?: string;
  [GPUCrashContextKeys.PC_ADDRESS]?: string;
  [GPUCrashContextKeys.SDK_VERSION]?: string;
  [GPUCrashContextKeys.SHADER_DEBUG_INFO_UID]?: string;
  [GPUCrashContextKeys.SHADER_HASH]?: string;
  [GPUCrashContextKeys.SHADER_NAME]?: string;
  [GPUCrashContextKeys.SHADER_TYPE]?: string;
  [GPUCrashContextKeys.STATUS]?: string;
  [GPUCrashContextKeys.VIRTUAL_ADDRESS]?: string;
}

export function getGPUCrashContextData({
  data,
  meta,
}: {
  data: GPUCrashContext;
  meta?: Record<keyof GPUCrashContext, any>;
}): KeyValueListData {
  return getContextKeys({data}).map(ctxKey => {
    switch (ctxKey) {
      case GPUCrashContextKeys.STATUS:
        return {key: ctxKey, subject: t('Status'), value: data.status};
      case GPUCrashContextKeys.HANDLER:
        return {key: ctxKey, subject: t('Handler'), value: data.handler};
      case GPUCrashContextKeys.SDK_VERSION:
        return {key: ctxKey, subject: t('SDK Version'), value: data.sdk_version};
      case GPUCrashContextKeys.DECODE_TIME_MS:
        return {
          key: ctxKey,
          subject: t('Decode Time (ms)'),
          value: data.decode_time_ms,
        };
      case GPUCrashContextKeys.FAULT_TYPE:
        return {key: ctxKey, subject: t('Fault Type'), value: data.fault_type};
      case GPUCrashContextKeys.FAULT_DESCRIPTION:
        return {
          key: ctxKey,
          subject: t('Fault Description'),
          value: data.fault_description,
        };
      case GPUCrashContextKeys.FAULT_CODE:
        return {key: ctxKey, subject: t('Fault Code'), value: data.fault_code};
      case GPUCrashContextKeys.VIRTUAL_ADDRESS:
        return {
          key: ctxKey,
          subject: t('Virtual Address'),
          value: data.virtual_address,
        };
      case GPUCrashContextKeys.ACCESS_TYPE:
        return {key: ctxKey, subject: t('Access Type'), value: data.access_type};
      case GPUCrashContextKeys.DEVICE_NAME:
        return {key: ctxKey, subject: t('Device Name'), value: data.device_name};
      case GPUCrashContextKeys.DEVICE_STATUS:
        return {
          key: ctxKey,
          subject: t('Device Status'),
          value: data.device_status,
        };
      case GPUCrashContextKeys.DRIVER_VERSION:
        return {
          key: ctxKey,
          subject: t('Driver Version'),
          value: data.driver_version,
        };
      case GPUCrashContextKeys.GRAPHICS_API:
        return {key: ctxKey, subject: t('Graphics API'), value: data.graphics_api};
      case GPUCrashContextKeys.OS_VERSION:
        return {key: ctxKey, subject: t('OS Version'), value: data.os_version};
      case GPUCrashContextKeys.APPLICATION_NAME:
        return {
          key: ctxKey,
          subject: t('Application Name'),
          value: data.application_name,
        };
      case GPUCrashContextKeys.APPLICATION_VERSION:
        return {
          key: ctxKey,
          subject: t('Application Version'),
          value: data.application_version,
        };
      case GPUCrashContextKeys.ENGINE_RESET:
        return {key: ctxKey, subject: t('Engine Reset'), value: data.engine_reset};
      case GPUCrashContextKeys.ADAPTER_RESET:
        return {
          key: ctxKey,
          subject: t('Adapter Reset'),
          value: data.adapter_reset,
        };
      case GPUCrashContextKeys.SHADER_HASH:
        return {key: ctxKey, subject: t('Shader Hash'), value: data.shader_hash};
      case GPUCrashContextKeys.SHADER_NAME:
        return {key: ctxKey, subject: t('Shader Name'), value: data.shader_name};
      case GPUCrashContextKeys.SHADER_TYPE:
        return {key: ctxKey, subject: t('Shader Type'), value: data.shader_type};
      case GPUCrashContextKeys.SHADER_DEBUG_INFO_UID:
        return {
          key: ctxKey,
          subject: t('Shader Debug Info UID'),
          value: data.shader_debug_info_uid,
        };
      case GPUCrashContextKeys.PC_ADDRESS:
        return {key: ctxKey, subject: t('PC Address'), value: data.pc_address};
      case GPUCrashContextKeys.MISSING_DIF_COUNT:
        return {
          key: ctxKey,
          subject: t('Missing Debug Files'),
          value: data.missing_dif_count,
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
