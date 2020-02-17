import React from 'react';

import ContextBlock from 'app/components/events/contexts/contextBlockV2';
import {defined} from 'app/utils';

import getRuntimeKnownData from './getRuntimeKnownData';
import {RuntimeData} from './types';

type Props = {
  data?: RuntimeData;
};

const Runtime = ({data}: Props) => {
  if (!defined(data)) {
    return null;
  }

  return <ContextBlock knownData={getRuntimeKnownData(data)} />;
};

Runtime.getTitle = () => 'Runtime';

export default Runtime;
