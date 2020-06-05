import React from 'react';

import ContextBlock from 'app/components/events/contexts/contextBlock';

import getAppKnownData from './getAppKnownData';
import {AppData, AppKnownDataType} from './types';

type Props = {
  data: AppData;
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

const App = ({data}: Props) => (
  <ContextBlock knownData={getAppKnownData(data, appKnownDataValues)} />
);

export default App;
