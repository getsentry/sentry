import { Fragment } from 'react';

import ContextBlock from 'app/components/events/contexts/contextBlock';

import getOperatingSystemKnownData from './getOperatingSystemKnownData';
import {
  OperatingSystemKnownData,
  OperatingSystemKnownDataType,
  OperatingSystemIgnoredDataType,
} from './types';
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

const operatingSystemIgnoredDataValues = [OperatingSystemIgnoredDataType.BUILD];

const OperatingSystem = ({data}: Props) => (
  <Fragment>
    <ContextBlock
      data={getOperatingSystemKnownData(data, operatingSystemKnownDataValues)}
    />
    <ContextBlock
      data={getUnknownData(data, [
        ...operatingSystemKnownDataValues,
        ...operatingSystemIgnoredDataValues,
      ])}
    />
  </Fragment>
);

export default OperatingSystem;
