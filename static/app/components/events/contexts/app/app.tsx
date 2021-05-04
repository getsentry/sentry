import {Fragment} from 'react';

import ContextBlock from 'app/components/events/contexts/contextBlock';
import {Event} from 'app/types/event';

import getUnknownData from '../getUnknownData';

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

const App = ({data, event}: Props) => (
  <Fragment>
    <ContextBlock data={getAppKnownData(event, data, appKnownDataValues)} />
    <ContextBlock
      data={getUnknownData(data, [...appKnownDataValues, ...appIgnoredDataValues])}
    />
  </Fragment>
);

export default App;
