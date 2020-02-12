import React from 'react';

import ContextBlock from 'app/components/events/contexts/contextBlock';

import getRuntimeKnownData, {RuntimeData} from './getRuntimeKnownData';

type Props = {
  data?: RuntimeData;
};

const Runtime = ({data}: Props) => {
  if (data === undefined || data === null) {
    return null;
  }

  return <ContextBlock knownData={getRuntimeKnownData(data)} />;
};

Runtime.getTitle = () => 'Runtime';

export default Runtime;
