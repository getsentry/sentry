import {Event, KeyValueListData} from 'sentry/types';

import {getGPUKnownDataDetails} from './getGPUKnownDataDetails';
import {GPUData, GPUKnownDataType} from './types';

type Props = {
  data: GPUData;
  gpuKnownDataValues: Array<GPUKnownDataType>;
  meta: NonNullable<Event['_meta']>['gpu'];
};

export function getGPUKnownData({
  data,
  gpuKnownDataValues,
  meta,
}: Props): KeyValueListData {
  const knownData: KeyValueListData = [];

  const dataKeys = gpuKnownDataValues.filter(gpuKnownDataValue => {
    if (
      typeof data[gpuKnownDataValue] !== 'number' &&
      typeof data[gpuKnownDataValue] !== 'boolean' &&
      !data[gpuKnownDataValue]
    ) {
      return !!meta[gpuKnownDataValue];
    }
    return true;
  });

  for (const type of dataKeys) {
    const knownDataDetails = getGPUKnownDataDetails({data, type});

    if (!knownDataDetails) {
      continue;
    }

    knownData.push({
      key: type,
      ...knownDataDetails,
      meta: meta[type]?.[''],
    });
  }

  return knownData;
}
