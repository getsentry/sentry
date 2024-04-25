import {Fragment} from 'react';

import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import type {Event} from 'sentry/types/event';

import {
  getContextMeta,
  getKnownData,
  getKnownStructuredData,
  getUnknownData,
} from '../utils';

import {getOperatingSystemKnownDataDetails} from './getOperatingSystemKnownDataDetails';
import type {OperatingSystemKnownData} from './types';
import {OperatingSystemIgnoredDataType, OperatingSystemKnownDataType} from './types';

type Props = {
  data: OperatingSystemKnownData;
  event: Event;
  meta?: Record<string, any>;
};

export const operatingSystemKnownDataValues = [
  OperatingSystemKnownDataType.NAME,
  OperatingSystemKnownDataType.VERSION,
  OperatingSystemKnownDataType.KERNEL_VERSION,
  OperatingSystemKnownDataType.ROOTED,
];

const operatingSystemIgnoredDataValues = [OperatingSystemIgnoredDataType.BUILD];

export function getKnownOperatingSystemContextData({
  data,
  meta,
}: Pick<Props, 'data' | 'meta'>) {
  return getKnownData<OperatingSystemKnownData, OperatingSystemKnownDataType>({
    data,
    meta,
    knownDataTypes: operatingSystemKnownDataValues,
    onGetKnownDataDetails: v => getOperatingSystemKnownDataDetails(v),
  });
}

export function getUnknownOperatingSystemContextData({
  data,
  meta,
}: Pick<Props, 'data' | 'meta'>) {
  return getUnknownData({
    allData: data,
    knownKeys: [...operatingSystemKnownDataValues, ...operatingSystemIgnoredDataValues],
    meta,
  });
}

export function OperatingSystemEventContext({data, event, meta: propsMeta}: Props) {
  const meta = propsMeta ?? getContextMeta(event, 'os');
  const knownData = getKnownOperatingSystemContextData({data, meta});
  const knownStructuredData = getKnownStructuredData(knownData, meta);
  const unknownData = getUnknownOperatingSystemContextData({data, meta});
  return (
    <Fragment>
      <ContextBlock data={knownStructuredData} />
      <ContextBlock data={unknownData} />
    </Fragment>
  );
}
