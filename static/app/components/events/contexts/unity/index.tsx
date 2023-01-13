import {Fragment} from 'react';

import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import {type Event, type UnityContext} from 'sentry/types';

import {geKnownData, getUnknownData} from '../utils';

import {getUnityKnownDataDetails, unityKnownDataValues} from './getUnityKnownDataDetails';

type Props = {
  data: UnityContext | null;
  event: Event;
};

export function UnityEventContext({data, event}: Props) {
  if (!data) {
    return null;
  }

  const meta = event._meta?.contexts?.unity ?? {};

  return (
    <Fragment>
      <ContextBlock
        data={geKnownData<UnityContext, keyof typeof unityKnownDataValues>({
          data,
          meta,
          knownDataTypes: unityKnownDataValues,
          onGetKnownDataDetails: v => getUnityKnownDataDetails(v),
        })}
      />
      <ContextBlock
        data={getUnknownData({
          allData: data,
          knownKeys: unityKnownDataValues,
          meta,
        })}
      />
    </Fragment>
  );
}
