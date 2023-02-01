import {Fragment} from 'react';

import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import {Event} from 'sentry/types/event';

import {getKnownData, getUnknownData} from '../utils';

import {getRuntimeKnownDataDetails} from './getRuntimeKnownDataDetails';
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
      <ContextBlock
        data={getKnownData<RuntimeData, RuntimeKnownDataType>({
          data,
          meta,
          knownDataTypes: runtimeKnownDataValues,
          onGetKnownDataDetails: v => getRuntimeKnownDataDetails(v),
        })}
      />
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
