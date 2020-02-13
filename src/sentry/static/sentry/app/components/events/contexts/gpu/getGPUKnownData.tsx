import {KeyValueListData} from 'app/components/events/interfaces/keyValueList/keyValueListV2';
import {getMeta} from 'app/components/events/meta/metaProxy';

import getGpuKnownDataDetails, {
  GPUData,
  GPUKnownDataDetailsType,
} from './getGPUKnownDataDetails';

function getGPUKnownData(
  data: GPUData,
  dataToBeFiltered: Array<GPUKnownDataDetailsType>
): Array<KeyValueListData> {
  const knownData: Array<KeyValueListData> = [];

  const filteredDataKeys = Object.keys(data).filter(key =>
    dataToBeFiltered.includes(key as GPUKnownDataDetailsType)
  );

  for (const key of filteredDataKeys) {
    const knownDataDetails = getGpuKnownDataDetails(data, key as GPUKnownDataDetailsType);

    if (key === null || !knownDataDetails) {
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

export {GPUData, GPUKnownDataDetailsType};
export default getGPUKnownData;
