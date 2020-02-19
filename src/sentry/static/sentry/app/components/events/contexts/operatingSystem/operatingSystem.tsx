import React from 'react';

import {defined} from 'app/utils';
import ContextBlock from 'app/components/events/contexts/contextBlockV2';

import getOperatingSystemKnownData from './getOperatingSystemKnownData';
import {OperatingSystemKnownData} from './types';

type Props = {
  data?: OperatingSystemKnownData;
};

const OperatingSystem = ({data}: Props) => {
  if (!defined(data)) {
    return null;
  }

  return <ContextBlock knownData={getOperatingSystemKnownData(data)} />;
};

OperatingSystem.getTitle = () => 'Operating System';

export default OperatingSystem;
