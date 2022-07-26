import {Fragment} from 'react';

import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import {Event} from 'sentry/types';

import {getUnknownData} from '../getUnknownData';

import {getOperatingSystemKnownData} from './getOperatingSystemKnownData';
import {
  OperatingSystemIgnoredDataType,
  OperatingSystemKnownData,
  OperatingSystemKnownDataType,
} from './types';

type Props = {
  data: OperatingSystemKnownData;
  event: Event;
};

export const operatingSystemKnownDataValues = [
  OperatingSystemKnownDataType.NAME,
  OperatingSystemKnownDataType.VERSION,
  OperatingSystemKnownDataType.KERNEL_VERSION,
  OperatingSystemKnownDataType.ROOTED,
];

const operatingSystemIgnoredDataValues = [OperatingSystemIgnoredDataType.BUILD];

export function OperatingSystemEventContext({data, event}: Props) {
  const meta = event._meta?.os ?? {};
  return (
    <Fragment>
      <ContextBlock data={getOperatingSystemKnownData({data, meta})} />
      <ContextBlock
        data={getUnknownData({
          allData: data,
          knownKeys: [
            ...operatingSystemKnownDataValues,
            ...operatingSystemIgnoredDataValues,
          ],
          meta,
        })}
      />
    </Fragment>
  );
}
