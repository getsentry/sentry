import {Fragment} from 'react';

import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import {Event, ThreadPoolInfoContext} from 'sentry/types/event';

import {getKnownData, getUnknownData} from '../utils';

import {
  getThreadPoolInfoKnownDataDetails,
  threadPoolInfoKnownDataValues,
} from './getThreadPoolInfoKnownDataDetails';

type Props = {
  data: ThreadPoolInfoContext | null;
  event: Event;
};

export function ThreadPoolInfoEventContext({data, event}: Props) {
  if (!data) {
    return null;
  }

  const meta =
    event._meta?.contexts?.['ThreadPool Info'] ??
    event._meta?.contexts?.threadpool_info ??
    {};

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
