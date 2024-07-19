import {Fragment} from 'react';

import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import type {Event} from 'sentry/types/event';

import {
  getContextMeta,
  getKnownData,
  getKnownStructuredData,
  getUnknownData,
} from '../utils';

import {getRuntimeKnownDataDetails} from './getRuntimeKnownDataDetails';
import type {RuntimeData} from './types';
import {RuntimeIgnoredDataType, RuntimeKnownDataType} from './types';

type Props = {
  data: RuntimeData;
  event: Event;
  meta?: Record<string, any>;
};

export const runtimeKnownDataValues = [
  RuntimeKnownDataType.NAME,
  RuntimeKnownDataType.VERSION,
];

const runtimeIgnoredDataValues = [RuntimeIgnoredDataType.BUILD];

export function getKnownRuntimeContextData({data, meta}: Pick<Props, 'data' | 'meta'>) {
  return getKnownData<RuntimeData, RuntimeKnownDataType>({
    data,
    meta,
    knownDataTypes: runtimeKnownDataValues,
    onGetKnownDataDetails: v => getRuntimeKnownDataDetails(v),
  });
}

export function getUnknownRuntimeContextData({data, meta}: Pick<Props, 'data' | 'meta'>) {
  return getUnknownData({
    allData: data,
    knownKeys: [...runtimeKnownDataValues, ...runtimeIgnoredDataValues],
    meta,
  });
}

export function RuntimeEventContext({data, event, meta: propsMeta}: Props) {
  const meta = propsMeta ?? getContextMeta(event, 'runtime');
  const knownData = getKnownRuntimeContextData({data, meta});
  const knownStructuredData = getKnownStructuredData(knownData, meta);
  const unknownData = getUnknownRuntimeContextData({data, meta});
  return (
    <Fragment>
      <ContextBlock data={knownStructuredData} />
      <ContextBlock data={unknownData} />
    </Fragment>
  );
}
