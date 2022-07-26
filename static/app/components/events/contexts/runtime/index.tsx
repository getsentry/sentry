import {Fragment} from 'react';

import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import {Event} from 'sentry/types/event';

import {getUnknownData} from '../getUnknownData';

import {getRuntimeKnownData} from './getRuntimeKnownData';
import {RuntimeData, RuntimeIgnoredDataType, RuntimeKnownDataType} from './types';

type Props = {
  data: RuntimeData;
  event: Event;
};

export const runtimeKnownDataValues = [
  RuntimeKnownDataType.NAME,
  RuntimeKnownDataType.VERSION,
];

const runtimeIgnoredDataValues = [RuntimeIgnoredDataType.BUILD];

export function RuntimeEventContext({data, event}: Props) {
  const meta = event._meta?.contexts?.runtime ?? {};
  return (
    <Fragment>
      <ContextBlock data={getRuntimeKnownData({data, meta})} />
      <ContextBlock
        data={getUnknownData({
          allData: data,
          knownKeys: [...runtimeKnownDataValues, ...runtimeIgnoredDataValues],
          meta,
        })}
      />
    </Fragment>
  );
}
