import {Fragment} from 'react';

import ContextBlock from 'sentry/components/events/contexts/contextBlock';

import {getUnknownData} from '../getUnknownData';

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

function OperatingSystem({data}: Props) {
  return (
    <Fragment>
      <ContextBlock
        data={getOperatingSystemKnownData(data, operatingSystemKnownDataValues)}
      />
      <ContextBlock
        data={getUnknownData({
          allData: data,
          knownKeys: [
            ...operatingSystemKnownDataValues,
            ...operatingSystemIgnoredDataValues,
          ],
        })}
      />
    </Fragment>
  );
}

export default OperatingSystem;
