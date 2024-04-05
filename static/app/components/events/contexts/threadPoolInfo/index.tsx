import {Fragment} from 'react';

import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import type {Event, ThreadPoolInfoContext} from 'sentry/types/event';

import {getKnownData, getUnknownData} from '../utils';

import {
  getThreadPoolInfoKnownDataDetails,
  threadPoolInfoKnownDataValues,
} from './getThreadPoolInfoKnownDataDetails';

type Props = {
  data: ThreadPoolInfoContext | null;
  event: Event;
  meta: Record<string, any>;
};

export function ThreadPoolInfoEventContext({data, event, meta}: Props) {
  if (!data) {
    return null;
  }

  return (
    <Fragment>
      <ContextBlock
        data={getKnownData<
          ThreadPoolInfoContext,
          (typeof threadPoolInfoKnownDataValues)[number]
        >({
          data,
          meta,
          knownDataTypes: threadPoolInfoKnownDataValues,
          onGetKnownDataDetails: v => getThreadPoolInfoKnownDataDetails({...v, event}),
        })}
      />
      <ContextBlock
        data={getUnknownData({
          allData: data,
          knownKeys: threadPoolInfoKnownDataValues,
          meta,
        })}
      />
    </Fragment>
  );
}
