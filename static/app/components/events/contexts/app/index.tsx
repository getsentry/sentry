import {Fragment} from 'react';

import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import type {Event} from 'sentry/types/event';

import {getContextMeta, getKnownData, getUnknownData} from '../utils';

import {getAppKnownDataDetails} from './getAppKnownDataDetails';
import type {AppData} from './types';
import {AppKnownDataType} from './types';

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

export function AppEventContext({data, event, meta: propsMeta}: Props) {
  const meta = propsMeta ?? getContextMeta(event, 'app');
  return (
    <Fragment>
      <ContextBlock
        data={getKnownData<AppData, AppKnownDataType>({
          data,
          meta,
          knownDataTypes: appKnownDataValues,
          onGetKnownDataDetails: v => getAppKnownDataDetails({...v, event}),
        })}
      />
      <ContextBlock
        data={getUnknownData({
          allData: data,
          knownKeys: [...appKnownDataValues, ...appIgnoredDataValues],
          meta,
        })}
      />
    </Fragment>
  );
}
