import {Fragment} from 'react';

import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import type {DeviceContext, Event} from 'sentry/types/event';

import {getContextMeta, getKnownData, getUnknownData} from '../utils';

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

export function DeviceEventContext({data, event, meta: propsMeta}: Props) {
  const inferredData = getInferredData(data);
  const meta = propsMeta ?? getContextMeta(event, 'device');

  return (
    <Fragment>
      <ContextBlock
        data={getKnownData<DeviceContext, (typeof deviceKnownDataValues)[number]>({
          data: inferredData,
          meta,
          knownDataTypes: deviceKnownDataValues,
          onGetKnownDataDetails: v => getDeviceKnownDataDetails({...v, event}),
        }).map(v => ({
          ...v,
          subjectDataTestId: `device-context-${v.key.toLowerCase()}-value`,
        }))}
      />
      <ContextBlock
        data={getUnknownData({
          allData: inferredData,
          knownKeys: [...deviceKnownDataValues, ...deviceIgnoredDataValues],
          meta,
        })}
      />
    </Fragment>
  );
}
