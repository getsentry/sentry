import {Fragment} from 'react';

import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import type {Event, MemoryInfoContext} from 'sentry/types/event';

import {
  getContextMeta,
  getKnownData,
  getKnownStructuredData,
  getUnknownData,
} from '../utils';

import {
  getMemoryInfoKnownDataDetails,
  memoryInfoKnownDataValues,
} from './getMemoryInfoKnownDataDetails';

type Props = {
  data: MemoryInfoContext | null;
  event: Event;
  meta?: Record<string, any>;
};

export function getKnownMemoryInfoContextData({data, event, meta}: Props) {
  if (!data) {
    return [];
  }
  return getKnownData<MemoryInfoContext, (typeof memoryInfoKnownDataValues)[number]>({
    data,
    meta,
    knownDataTypes: memoryInfoKnownDataValues,
    onGetKnownDataDetails: v => getMemoryInfoKnownDataDetails({...v, event}),
  });
}

export function getUnknownMemoryInfoContextData({
  data,
  meta,
}: Pick<Props, 'data' | 'meta'>) {
  if (!data) {
    return [];
  }
  return getUnknownData({
    allData: data,
    knownKeys: memoryInfoKnownDataValues,
    meta,
  });
}

export function MemoryInfoEventContext({data, event, meta: propsMeta}: Props) {
  if (!data) {
    return null;
  }
  const meta = propsMeta ?? getContextMeta(event, 'memory_info');
  const knownData = getKnownMemoryInfoContextData({data, event, meta});
  const knownStructuredData = getKnownStructuredData(knownData, meta);
  const unknownData = getUnknownMemoryInfoContextData({data, meta});

  return (
    <Fragment>
      <ContextBlock data={knownStructuredData} />
      <ContextBlock data={unknownData} />
    </Fragment>
  );
}
