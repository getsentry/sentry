import {KeyValueListData} from 'app/components/events/interfaces/keyValueList/types';
import {getMeta} from 'app/components/events/meta/metaProxy';

import getGpuKnownDataDetails from './getGPUKnownDataDetails';
import {GPUData, GPUKnownDataType} from './types';

function getGPUKnownData(
  data: GPUData,
  dataToBeFiltered: Array<GPUKnownDataType>
): Array<KeyValueListData> {
  const knownData: Array<KeyValueListData> = [];

  const filteredDataKeys = Object.keys(data).filter(key =>
    dataToBeFiltered.includes(key as GPUKnownDataType)
  );

  for (const key of filteredDataKeys) {
    const knownDataDetails = getGpuKnownDataDetails(data, key as GPUKnownDataType);

    if (!knownDataDetails) {
      continue;
    }

    knownData.push({
      key,
      ...knownDataDetails,
      meta: getMeta(data, key),
    });
  }
  return knownData;
}

export default getGPUKnownData;
