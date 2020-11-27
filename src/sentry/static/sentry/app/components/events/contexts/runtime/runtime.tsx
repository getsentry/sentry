import React from 'react';

import ContextBlock from 'app/components/events/contexts/contextBlock';

import getUnknownData from '../getUnknownData';

import getRuntimeKnownData from './getRuntimeKnownData';
import {RuntimeData, RuntimeIgnoredDataType, RuntimeKnownDataType} from './types';

type Props = {
  data: RuntimeData;
};

const runtimeKnownDataValues = [RuntimeKnownDataType.NAME, RuntimeKnownDataType.VERSION];

const runtimeIgnoredDataValues = [RuntimeIgnoredDataType.BUILD];

const Runtime = ({data}: Props) => {
  return (
    <React.Fragment>
      <ContextBlock data={getRuntimeKnownData(data, runtimeKnownDataValues)} />
      <ContextBlock
        data={getUnknownData(data, [
          ...runtimeKnownDataValues,
          ...runtimeIgnoredDataValues,
        ])}
      />
    </React.Fragment>
  );
};

export default Runtime;
