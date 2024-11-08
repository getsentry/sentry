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

export const gpuKnownDataValues = Object.values(GPUKnownDataType);

const gpuIgnoredDataValues = [];

export function getKnownGpuContextData({data, meta}: Pick<Props, 'data' | 'meta'>) {
  return getKnownData<GPUData, GPUKnownDataType>({
    data,
    meta,
    knownDataTypes: gpuKnownDataValues,
    onGetKnownDataDetails: v => getGPUKnownDataDetails(v),
  });
}

export function getUnknownGpuContextData({data, meta}: Pick<Props, 'data' | 'meta'>) {
  return getUnknownData({
    allData: data,
    knownKeys: [...gpuKnownDataValues, ...gpuIgnoredDataValues],
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
