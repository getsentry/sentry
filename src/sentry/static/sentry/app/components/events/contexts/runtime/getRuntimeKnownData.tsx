import {KeyValueListData} from 'app/components/events/interfaces/keyValueList/keyValueListV2';
import {getMeta} from 'app/components/events/meta/metaProxy';

import getRuntimeKnownDataDetails, {
  RuntimeData,
  RuntimeKnownDataDetailsType,
} from './getRuntimeKnownDataDetails';

function getRuntimeKnownData(data: RuntimeData): Array<KeyValueListData> {
  const knownData: Array<KeyValueListData> = [];

  const dataKeys = Object.keys(data);
  for (const key of dataKeys) {
    const knownDataDetails = getRuntimeKnownDataDetails(
      data,
      key as RuntimeKnownDataDetailsType
    );

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

export {RuntimeData};
export default getRuntimeKnownData;
