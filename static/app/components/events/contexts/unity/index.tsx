import {Fragment} from 'react';

import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import type {Event, UnityContext} from 'sentry/types/event';

import {
  getContextMeta,
  getKnownData,
  getKnownStructuredData,
  getUnknownData,
} from '../utils';

import {getUnityKnownDataDetails, unityKnownDataValues} from './getUnityKnownDataDetails';

type Props = {
  data: UnityContext | null;
  event: Event;
  meta?: Record<string, any>;
};

export function getKnownUnityContextData({data, meta}: Pick<Props, 'data' | 'meta'>) {
  if (!data) {
    return [];
  }
  return getKnownData<UnityContext, (typeof unityKnownDataValues)[number]>({
    data,
    meta,
    knownDataTypes: unityKnownDataValues,
    onGetKnownDataDetails: v => getUnityKnownDataDetails(v),
  });
}

export function getUnknownUnityContextData({data, meta}: Pick<Props, 'data' | 'meta'>) {
  if (!data) {
    return [];
  }
  return getUnknownData({
    allData: data,
    knownKeys: unityKnownDataValues,
    meta,
  });
}

export function UnityEventContext({data, event, meta: propsMeta}: Props) {
  if (!data) {
    return null;
  }
  const meta = propsMeta ?? getContextMeta(event, 'unity');
  const knownData = getKnownUnityContextData({data, meta});
  const knownStructuredData = getKnownStructuredData(knownData, meta);
  const unknownData = getUnknownUnityContextData({data, meta});

  return (
    <Fragment>
      <ContextBlock data={knownStructuredData} />
      <ContextBlock data={unknownData} />
    </Fragment>
  );
}
