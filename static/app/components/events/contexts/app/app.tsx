import {Fragment} from 'react';

import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import {Event} from 'sentry/types/event';

import {getUnknownData} from '../getUnknownData';

import getAppKnownData from './getAppKnownData';
import {AppData, AppKnownDataType} from './types';

type Props = {
  data: AppData;
  event: Event;
};

const appKnownDataValues = [
  AppKnownDataType.ID,
  AppKnownDataType.START_TIME,
  AppKnownDataType.DEVICE_HASH,
  AppKnownDataType.IDENTIFIER,
  AppKnownDataType.NAME,
  AppKnownDataType.VERSION,
  AppKnownDataType.BUILD,
];

const appIgnoredDataValues = [];

function App({data, event}: Props) {
  return (
    <Fragment>
      <ContextBlock data={getAppKnownData(event, data, appKnownDataValues)} />
      <ContextBlock
        data={getUnknownData({
          allData: data,
          knownKeys: [...appKnownDataValues, ...appIgnoredDataValues],
        })}
      />
    </Fragment>
  );
}

export default App;
