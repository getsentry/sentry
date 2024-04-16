import {Fragment} from 'react';

import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import type {Event} from 'sentry/types/event';

import {
  getContextMeta,
  getKnownData,
  getKnownStructuredData,
  getUnknownData,
} from '../utils';

import {getAppKnownDataDetails} from './getAppKnownDataDetails';
import {type AppData, AppKnownDataType} from './types';

type Props = {
  data: AppData;
  event: Event;
  meta?: Record<string, any>;
};

export const appKnownDataValues = [
  AppKnownDataType.ID,
  AppKnownDataType.START_TIME,
  AppKnownDataType.DEVICE_HASH,
  AppKnownDataType.IDENTIFIER,
  AppKnownDataType.NAME,
  AppKnownDataType.VERSION,
  AppKnownDataType.BUILD,
  AppKnownDataType.IN_FOREGROUND,
];

const appIgnoredDataValues = [];

export function getKnownAppContextData({data, event, meta}: Props) {
  return getKnownData<AppData, AppKnownDataType>({
    data,
    meta,
    knownDataTypes: appKnownDataValues,
    onGetKnownDataDetails: v => getAppKnownDataDetails({...v, event}),
  });
}

export function getUnknownAppContextData({data, meta}: Pick<Props, 'data' | 'meta'>) {
  return getUnknownData({
    allData: data,
    knownKeys: [...appKnownDataValues, ...appIgnoredDataValues],
    meta,
  });
}

export function AppEventContext({data, event, meta: propsMeta}: Props) {
  const meta = propsMeta ?? getContextMeta(event, 'app');
  const knownData = getKnownAppContextData({data, event, meta});
  const knownStructuredData = getKnownStructuredData(knownData, meta);
  const unknownData = getUnknownAppContextData({data, meta});
  return (
    <Fragment>
      <ContextBlock data={knownStructuredData} />
      <ContextBlock data={unknownData} />
    </Fragment>
  );
}
