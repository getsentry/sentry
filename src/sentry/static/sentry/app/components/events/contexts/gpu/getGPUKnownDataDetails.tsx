import {t} from 'app/locale';

import formatMemory from './formatMemory';

export enum GPUKnownDataDetailsType {
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

type Output = {
  subject: string;
  value: string | null | boolean | number;
};

function getGPUKnownDataDetails(
  data: GPUData,
  type: GPUKnownDataDetailsType
): Output | undefined {
  switch (type) {
    case GPUKnownDataDetailsType.NAME:
      return {
        subject: t('Name'),
        value: data.name || null,
      };
    case GPUKnownDataDetailsType.VERSION:
      return {
        subject: t('Version'),
        value: data.version || null,
      };
    case GPUKnownDataDetailsType.MEMORY:
      return {
        subject: t('Memory'),
        value: data.memory_size ? formatMemory(data.memory_size) : null,
      };
    case GPUKnownDataDetailsType.NPOT_SUPPORT:
      return {
        subject: t('NPOT Support'),
        value: data.npot_support || null,
      };
    case GPUKnownDataDetailsType.MULTI_THREAD_RENDERING:
      return {
        subject: t('Multi-Thread rendering'),
        value: data.multi_threaded_rendering || null,
      };
    case GPUKnownDataDetailsType.API_TYPE:
      return {
        subject: t('API Type'),
        value: data.api_type || null,
      };
    case GPUKnownDataDetailsType.VENDOR_ID:
      return {
        subject: t('Vendor ID'),
        value: data.vendor_id,
      };
    case GPUKnownDataDetailsType.ID:
      return {
        subject: t('GPU ID'),
        value: data.id,
      };
    default:
      return undefined;
  }
}

export default getGPUKnownDataDetails;
