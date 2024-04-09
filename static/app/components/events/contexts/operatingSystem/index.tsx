import {Fragment} from 'react';

import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import type {Event} from 'sentry/types';

import {getContextMeta, getKnownData, getUnknownData} from '../utils';

import {getOperatingSystemKnownDataDetails} from './getOperatingSystemKnownDataDetails';
import type {OperatingSystemKnownData} from './types';
import {OperatingSystemIgnoredDataType, OperatingSystemKnownDataType} from './types';

type Props = {
  data: OperatingSystemKnownData;
  event: Event;
  meta?: Record<string, any>;
};

export const operatingSystemKnownDataValues = [
  OperatingSystemKnownDataType.NAME,
  OperatingSystemKnownDataType.VERSION,
  OperatingSystemKnownDataType.KERNEL_VERSION,
  OperatingSystemKnownDataType.ROOTED,
];

const operatingSystemIgnoredDataValues = [OperatingSystemIgnoredDataType.BUILD];

export function OperatingSystemEventContext({data, event, meta: propsMeta}: Props) {
  const meta = propsMeta ?? getContextMeta(event, 'os');
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
