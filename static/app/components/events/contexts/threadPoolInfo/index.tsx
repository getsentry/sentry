import {Fragment} from 'react';

import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import type {Event, ThreadPoolInfoContext} from 'sentry/types/event';

import {
  getContextMeta,
  getKnownData,
  getKnownStructuredData,
  getUnknownData,
} from '../utils';

import {
  getThreadPoolInfoKnownDataDetails,
  threadPoolInfoKnownDataValues,
} from './getThreadPoolInfoKnownDataDetails';

type Props = {
  data: ThreadPoolInfoContext | null;
  event: Event;
  meta?: Record<string, any>;
};

export function getKnownThreadPoolInfoContextData({data, event, meta}: Props) {
  if (!data) {
    return [];
  }
  return getKnownData<
    ThreadPoolInfoContext,
    (typeof threadPoolInfoKnownDataValues)[number]
  >({
    data,
    meta,
    knownDataTypes: threadPoolInfoKnownDataValues,
    onGetKnownDataDetails: v => getThreadPoolInfoKnownDataDetails({...v, event}),
  });
}

export function getUnknownThreadPoolInfoContextData({
  data,
  meta,
}: Pick<Props, 'data' | 'meta'>) {
  if (!data) {
    return [];
  }
  return getUnknownData({
    allData: data,
    knownKeys: threadPoolInfoKnownDataValues,
    meta,
  });
}

export function ThreadPoolInfoEventContext({data, event, meta: propsMeta}: Props) {
  if (!data) {
    return null;
  }
  const meta = propsMeta ?? getContextMeta(event, 'threadpool_info');
  const knownData = getKnownThreadPoolInfoContextData({data, event, meta});
  const knownStructuredData = getKnownStructuredData(knownData, meta);
  const unknownData = getUnknownThreadPoolInfoContextData({data, meta});

  return (
    <Fragment>
      <ContextBlock data={knownStructuredData} />
      <ContextBlock data={unknownData} />
    </Fragment>
  );
}
