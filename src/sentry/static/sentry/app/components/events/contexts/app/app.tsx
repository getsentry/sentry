import { Fragment } from 'react';

import ContextBlock from 'app/components/events/contexts/contextBlock';

import getAppKnownData from './getAppKnownData';
import {AppData, AppKnownDataType} from './types';
import getUnknownData from '../getUnknownData';

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

const appIgnoredDataValues = [];

const App = ({data}: Props) => (
  <Fragment>
    <ContextBlock data={getAppKnownData(data, appKnownDataValues)} />
    <ContextBlock
      data={getUnknownData(data, [...appKnownDataValues, ...appIgnoredDataValues])}
    />
  </Fragment>
);

export default App;
