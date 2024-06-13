import {Fragment} from 'react';

import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import type {Event} from 'sentry/types/event';

import {
  getContextMeta,
  getKnownData,
  getKnownStructuredData,
  getUnknownData,
} from '../utils';

import {getBrowserKnownDataDetails} from './getBrowserKnownDataDetails';
import type {BrowserKnownData} from './types';
import {BrowserKnownDataType} from './types';

type Props = {
  data: BrowserKnownData;
  event: Event;
  meta?: Record<string, any>;
};

export const browserKnownDataValues = [
  BrowserKnownDataType.NAME,
  BrowserKnownDataType.VERSION,
];

export function getKnownBrowserContextData({data, meta}: Pick<Props, 'data' | 'meta'>) {
  return getKnownData<BrowserKnownData, BrowserKnownDataType>({
    data,
    meta,
    knownDataTypes: browserKnownDataValues,
    onGetKnownDataDetails: v => getBrowserKnownDataDetails(v),
  });
}

export function getUnknownBrowserContextData({data, meta}: Pick<Props, 'data' | 'meta'>) {
  return getUnknownData({
    allData: data,
    knownKeys: [...browserKnownDataValues],
    meta,
  });
}

export function BrowserEventContext({data, event, meta: propsMeta}: Props) {
  const meta = propsMeta ?? getContextMeta(event, 'browser');
  const knownData = getKnownBrowserContextData({data, meta});
  const knownStructuredData = getKnownStructuredData(knownData, meta);
  const unknownData = getUnknownBrowserContextData({data, meta});
  return (
    <Fragment>
      <ContextBlock data={knownStructuredData} />
      <ContextBlock data={unknownData} />
    </Fragment>
  );
}
