import {Fragment} from 'react';

import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import {Event, MemoryInfoContext} from 'sentry/types/event';

import {getKnownData, getUnknownData} from '../utils';

import {
  getMemoryInfoKnownDataDetails,
  memoryInfoKnownDataValues,
} from './getMemoryInfoKnownDataDetails';

type Props = {
  data: MemoryInfoContext | null;
  event: Event;
};

export function MemoryInfoEventContext({data, event}: Props) {
  if (!data) {
    return null;
  }

  const meta =
    event._meta?.contexts?.['Memory Info'] ?? event._meta?.contexts?.memory_info ?? {};

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
