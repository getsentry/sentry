import {Fragment} from 'react';

import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import {Event} from 'sentry/types';

import {getKnownData, getUnknownData} from '../utils';

import {getOperatingSystemKnownDataDetails} from './getOperatingSystemKnownDataDetails';
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
  const meta = event._meta?.contexts?.os ?? {};
  return (
    <Fragment>
      <ContextBlock
        data={getKnownData<OperatingSystemKnownData, OperatingSystemKnownDataType>({
          data,
          meta,
          knownDataTypes: operatingSystemKnownDataValues,
          onGetKnownDataDetails: v => getOperatingSystemKnownDataDetails(v),
        })}
      />
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
