import React from 'react';

import ContextBlock from 'app/components/events/contexts/contextBlock';

import getRuntimeKnownData from './getRuntimeKnownData';
import {RuntimeData, RuntimeKnownDataType} from './types';

type Props = {
  data: RuntimeData;
};

const runTimerKnownDataValues = [RuntimeKnownDataType.NAME, RuntimeKnownDataType.VERSION];

const Runtime = ({data}: Props) => (
  <ContextBlock knownData={getRuntimeKnownData(data, runTimerKnownDataValues)} />
);

export default Runtime;
