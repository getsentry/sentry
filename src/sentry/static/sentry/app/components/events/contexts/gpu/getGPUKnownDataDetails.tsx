import {t} from 'app/locale';

import formatMemory from './formatMemory';
import {GPUData, GPUKnownDataType} from './types';

type Output = {
  subject: string;
  value: React.ReactNode | null;
};

function getGPUKnownDataDetails(data: GPUData, type: GPUKnownDataType): Output {
  switch (type) {
    case GPUKnownDataType.NAME:
      return {
        subject: t('Name'),
        value: data.name || null,
      };
    case GPUKnownDataType.VERSION:
      return {
        subject: t('Version'),
        value: data.version || null,
      };
    case GPUKnownDataType.MEMORY:
      return {
        subject: t('Memory'),
        value: data.memory_size ? formatMemory(data.memory_size) : null,
      };
    case GPUKnownDataType.NPOT_SUPPORT:
      return {
        subject: t('NPOT Support'),
        value: data.npot_support || null,
      };
    case GPUKnownDataType.MULTI_THREAD_RENDERING:
      return {
        subject: t('Multi-Thread rendering'),
        value: data.multi_threaded_rendering || null,
      };
    case GPUKnownDataType.API_TYPE:
      return {
        subject: t('API Type'),
        value: data.api_type || null,
      };
    case GPUKnownDataType.VENDOR_ID:
      return {
        subject: t('Vendor ID'),
        value: data.vendor_id,
      };
    case GPUKnownDataType.ID:
      return {
        subject: t('GPU ID'),
        value: data.id,
      };
    default:
      return {
        subject: type,
        value: data[type] || null,
      };
  }
}

export default getGPUKnownDataDetails;
