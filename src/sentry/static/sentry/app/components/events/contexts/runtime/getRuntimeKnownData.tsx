import {KeyValueListData} from 'app/components/events/interfaces/keyValueList/types';
import {getMeta} from 'app/components/events/meta/metaProxy';

import getRuntimeKnownDataDetails from './getRuntimeKnownDataDetails';
import {RuntimeData, RuntimeKnownDataType} from './types';

function getRuntimeKnownData(data: RuntimeData): Array<KeyValueListData> {
  const knownData: Array<KeyValueListData> = [];

  const dataKeys = Object.keys(data);
  for (const key of dataKeys) {
    const knownDataDetails = getRuntimeKnownDataDetails(
      data,
      key as RuntimeKnownDataType
    );

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

export default getRuntimeKnownData;
