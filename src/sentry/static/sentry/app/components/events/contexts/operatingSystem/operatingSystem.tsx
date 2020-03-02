import React from 'react';

import ContextBlock from 'app/components/events/contexts/contextBlockV2';

import getOperatingSystemKnownData from './getOperatingSystemKnownData';
import {OperatingSystemKnownData, OperatingSystemKnownDataType} from './types';

type Props = {
  data: OperatingSystemKnownData;
};

const operatingSystemKnownDataValues = [
  OperatingSystemKnownDataType.NAME,
  OperatingSystemKnownDataType.VERSION,
  OperatingSystemKnownDataType.KERNEL_VERSION,
  OperatingSystemKnownDataType.ROOTED,
];

const OperatingSystem = ({data}: Props) => (
  <ContextBlock
    knownData={getOperatingSystemKnownData(data, operatingSystemKnownDataValues)}
  />
);

OperatingSystem.getTitle = () => 'Operating System';

export default OperatingSystem;
