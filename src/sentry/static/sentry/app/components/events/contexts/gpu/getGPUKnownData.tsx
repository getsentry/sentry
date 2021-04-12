import {getMeta} from 'app/components/events/meta/metaProxy';
import {KeyValueListData} from 'app/types';
import {defined} from 'app/utils';

import getGpuKnownDataDetails from './getGPUKnownDataDetails';
import {GPUData, GPUKnownDataType} from './types';

function getGPUKnownData(
  data: GPUData,
  gpuKnownDataValues: Array<GPUKnownDataType>
): KeyValueListData {
  const knownData: KeyValueListData = [];

  const dataKeys = gpuKnownDataValues.filter(gpuKnownDataValue =>
    defined(data[gpuKnownDataValue])
  );

  for (const key of dataKeys) {
    const knownDataDetails = getGpuKnownDataDetails(data, key as GPUKnownDataType);

    knownData.push({
      key,
      ...knownDataDetails,
      meta: getMeta(data, key),
    });
  }
  return knownData;
}

export default getGPUKnownData;
