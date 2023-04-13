import {Fragment} from 'react';

import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import {Event, UnityContext} from 'sentry/types';

import {getKnownData, getUnknownData} from '../utils';

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
        data={getKnownData<UnityContext, (typeof unityKnownDataValues)[number]>({
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
