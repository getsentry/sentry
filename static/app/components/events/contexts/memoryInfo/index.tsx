import {Fragment} from 'react';

import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import type {Event, MemoryInfoContext} from 'sentry/types/event';

import {getContextMeta, getKnownData, getUnknownData} from '../utils';

import {
  getMemoryInfoKnownDataDetails,
  memoryInfoKnownDataValues,
} from './getMemoryInfoKnownDataDetails';

type Props = {
  data: MemoryInfoContext | null;
  event: Event;
  meta?: Record<string, any>;
};

export function MemoryInfoEventContext({data, event, meta: propsMeta}: Props) {
  if (!data) {
    return null;
  }
  const meta = propsMeta ?? getContextMeta(event, 'memory_info');

  return (
    <Fragment>
      <ContextBlock
        data={getKnownData<MemoryInfoContext, (typeof memoryInfoKnownDataValues)[number]>(
          {
            data,
            meta,
            knownDataTypes: memoryInfoKnownDataValues,
            onGetKnownDataDetails: v => getMemoryInfoKnownDataDetails({...v, event}),
          }
        )}
      />
      <ContextBlock
        data={getUnknownData({
          allData: data,
          knownKeys: memoryInfoKnownDataValues,
          meta,
        })}
      />
    </Fragment>
  );
}
