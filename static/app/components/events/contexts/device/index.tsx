import {Fragment} from 'react';

import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import {DeviceContext, Event} from 'sentry/types/event';

import {getKnownData, getUnknownData} from '../utils';

import {
  deviceKnownDataValues,
  getDeviceKnownDataDetails,
} from './getDeviceKnownDataDetails';
import {getInferredData} from './utils';

type Props = {
  data: DeviceContext;
  event: Event;
};

const deviceIgnoredDataValues = [];

export function DeviceEventContext({data, event}: Props) {
  const inferredData = getInferredData(data);
  const meta = event._meta?.contexts?.device ?? {};

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
