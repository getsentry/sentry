import {t} from 'sentry/locale';

import formatMemory from './formatMemory';
import {GPUData, GPUKnownDataType} from './types';

type Output = {
  subject: string;
  value?: React.ReactNode;
};

type Props = {
  data: GPUData;
  type: GPUKnownDataType;
};

export function getGPUKnownDataDetails({data, type}: Props): Output | undefined {
  switch (type) {
    case GPUKnownDataType.NAME:
      return {
        subject: t('Name'),
        value: data.name,
      };
    case GPUKnownDataType.VERSION:
      return {
        subject: t('Version'),
        value: data.version,
      };
    case GPUKnownDataType.MEMORY_SIZE:
      return {
        subject: t('Memory'),
        value: data.memory_size ? formatMemory(data.memory_size) : undefined,
      };
    case GPUKnownDataType.NPOT_SUPPORT:
      return {
        subject: t('NPOT Support'),
        value: data.npot_support,
      };
    case GPUKnownDataType.VENDOR_NAME:
      return {
        subject: t('Vendor Name'),
        value: data.vendor_name,
      };
    case GPUKnownDataType.MULTI_THREAD_RENDERING:
      return {
        subject: t('Multi-Thread rendering'),
        value: data.multi_threaded_rendering,
      };
    case GPUKnownDataType.API_TYPE:
      return {
        subject: t('API Type'),
        value: data.api_type,
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
      return undefined;
  }
}
