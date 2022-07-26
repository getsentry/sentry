import {Event, KeyValueListData} from 'sentry/types';
import {defined} from 'sentry/utils';

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
    if (!defined(data[gpuKnownDataValue])) {
      if (meta[gpuKnownDataValue]) {
        return true;
      }
      return false;
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
