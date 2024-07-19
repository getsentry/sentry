import {Fragment} from 'react';

import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import type {Event} from 'sentry/types/event';

import {
  getContextMeta,
  getKnownData,
  getKnownStructuredData,
  getUnknownData,
} from '../utils';

import {getGPUKnownDataDetails} from './getGPUKnownDataDetails';
import type {GPUData} from './types';
import {GPUKnownDataType} from './types';

type Props = {
  data: GPUData;
  event: Event;
  meta?: Record<string, any>;
};

export const gpuKnownDataValues = [
  GPUKnownDataType.NAME,
  GPUKnownDataType.VERSION,
  GPUKnownDataType.VENDOR_NAME,
  GPUKnownDataType.MEMORY_SIZE,
  GPUKnownDataType.NPOT_SUPPORT,
  GPUKnownDataType.MULTI_THREAD_RENDERING,
  GPUKnownDataType.API_TYPE,
];

const gpuIgnoredDataValues = [];

function getGpuValues({data}: Pick<Props, 'data'>) {
  const gpuValues = [...gpuKnownDataValues];
  if (data.vendor_id > 0) {
    gpuValues.unshift(GPUKnownDataType.VENDOR_ID);
  }
  if (data.id > 0) {
    gpuValues.unshift(GPUKnownDataType.ID);
  }
  return gpuValues;
}

export function getKnownGpuContextData({data, meta}: Pick<Props, 'data' | 'meta'>) {
  const gpuValues = getGpuValues({data});
  return getKnownData<GPUData, GPUKnownDataType>({
    data,
    meta,
    knownDataTypes: gpuValues,
    onGetKnownDataDetails: v => getGPUKnownDataDetails(v),
  });
}

export function getUnknownGpuContextData({data, meta}: Pick<Props, 'data' | 'meta'>) {
  const gpuValues = getGpuValues({data});
  return getUnknownData({
    allData: data,
    knownKeys: [...gpuValues, ...gpuIgnoredDataValues],
    meta,
  });
}

export function GPUEventContext({data, event, meta: propsMeta}: Props) {
  const meta = propsMeta ?? getContextMeta(event, 'gpu');
  const knownData = getKnownGpuContextData({data, meta});
  const knownStructuredData = getKnownStructuredData(knownData, meta);
  const unknownData = getUnknownGpuContextData({data, meta});
  return (
    <Fragment>
      <ContextBlock data={knownStructuredData} />
      <ContextBlock data={unknownData} />
    </Fragment>
  );
}
