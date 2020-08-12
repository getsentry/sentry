import React from 'react';

import ContextBlock from 'app/components/events/contexts/contextBlock';

import getOperatingSystemKnownData from './getOperatingSystemKnownData';
import {OperatingSystemKnownData, OperatingSystemKnownDataType} from './types';
import getUnknownData from '../getUnknownData';

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
  <React.Fragment>
    <ContextBlock
      data={getOperatingSystemKnownData(data, operatingSystemKnownDataValues)}
    />
    <ContextBlock data={getUnknownData(data, operatingSystemKnownDataValues)} />
  </React.Fragment>
);

export default OperatingSystem;
