import React from 'react';

import ContextBlock from 'app/components/events/contexts/contextBlockV2';
import {defined} from 'app/utils';

import getRuntimeKnownData from './getRuntimeKnownData';
import {RuntimeData, RuntimeKnownDataType} from './types';

type Props = {
  data?: RuntimeData;
};

const runTimerKnownDataValues = [RuntimeKnownDataType.NAME, RuntimeKnownDataType.VERSION];

const Runtime = ({data}: Props) => {
  if (!defined(data)) {
    return null;
  }

  return <ContextBlock knownData={getRuntimeKnownData(data, runTimerKnownDataValues)} />;
};

Runtime.getTitle = () => 'Runtime';

export default Runtime;
