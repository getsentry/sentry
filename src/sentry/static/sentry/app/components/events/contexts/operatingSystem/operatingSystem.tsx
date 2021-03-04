import React from 'react';

import ContextBlock from 'app/components/events/contexts/contextBlock';

import getUnknownData from '../getUnknownData';

import getOperatingSystemKnownData from './getOperatingSystemKnownData';
import {
  OperatingSystemIgnoredDataType,
  OperatingSystemKnownData,
  OperatingSystemKnownDataType,
} from './types';

type Props = {
  data: OperatingSystemKnownData;
};

const operatingSystemKnownDataValues = [
  OperatingSystemKnownDataType.NAME,
  OperatingSystemKnownDataType.VERSION,
  OperatingSystemKnownDataType.KERNEL_VERSION,
  OperatingSystemKnownDataType.ROOTED,
];

const operatingSystemIgnoredDataValues = [OperatingSystemIgnoredDataType.BUILD];

const OperatingSystem = ({data}: Props) => (
  <React.Fragment>
    <ContextBlock
      data={getOperatingSystemKnownData(data, operatingSystemKnownDataValues)}
    />
    <ContextBlock
      data={getUnknownData(data, [
        ...operatingSystemKnownDataValues,
        ...operatingSystemIgnoredDataValues,
      ])}
    />
  </React.Fragment>
);

export default OperatingSystem;
