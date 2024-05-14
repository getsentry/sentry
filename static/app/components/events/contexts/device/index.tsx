import {Fragment} from 'react';

import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import type {DeviceContext, Event} from 'sentry/types/event';

import {
  getContextMeta,
  getKnownData,
  getKnownStructuredData,
  getUnknownData,
} from '../utils';

import {
  deviceKnownDataValues,
  getDeviceKnownDataDetails,
} from './getDeviceKnownDataDetails';
import {getInferredData} from './utils';

type Props = {
  data: DeviceContext;
  event: Event;
  meta?: Record<string, any>;
};

const deviceIgnoredDataValues = [];

export function getKnownDeviceContextData({data, event, meta}: Props) {
  const inferredData = getInferredData(data);
  return getKnownData<DeviceContext, (typeof deviceKnownDataValues)[number]>({
    data: inferredData,
    meta,
    knownDataTypes: deviceKnownDataValues,
    onGetKnownDataDetails: v => getDeviceKnownDataDetails({...v, event}),
  }).map(v => ({
    ...v,
    subjectDataTestId: `device-context-${v.key.toLowerCase()}-value`,
  }));
}

export function getUnknownDeviceContextData({data, meta}: Pick<Props, 'data' | 'meta'>) {
  const inferredData = getInferredData(data);
  return getUnknownData({
    allData: inferredData,
    knownKeys: [...deviceKnownDataValues, ...deviceIgnoredDataValues],
    meta,
  });
}

export function DeviceEventContext({data, event, meta: propsMeta}: Props) {
  const meta = propsMeta ?? getContextMeta(event, 'device');
  const knownData = getKnownDeviceContextData({data, event, meta});
  const knownStructuredData = getKnownStructuredData(knownData, meta);
  const unknownData = getUnknownDeviceContextData({data, meta});

  return (
    <Fragment>
      <ContextBlock data={knownStructuredData} />
      <ContextBlock data={unknownData} />
    </Fragment>
  );
}
