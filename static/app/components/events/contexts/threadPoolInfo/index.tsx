import {Fragment} from 'react';

import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import {getChildMetaContainer} from 'sentry/components/events/meta/metaContainer';
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
    getChildMetaContainer(event._meta, 'contexts', 'ThreadPool Info') ??
    getChildMetaContainer(event._meta, 'contexts', 'threadpool_info');

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
