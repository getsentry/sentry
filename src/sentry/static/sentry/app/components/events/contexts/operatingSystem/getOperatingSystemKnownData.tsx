import {KeyValueListData} from 'app/components/events/interfaces/keyValueList/types';
import {getMeta} from 'app/components/events/meta/metaProxy';

import getOperatingSystemKnownDataDetails from './getOperatingSystemKnownDataDetails';
import {OperatingSystemKnownData, OperatingSystemKnownDataType} from './types';

function getOperatingSystemKnownData(
  data: OperatingSystemKnownData
): Array<KeyValueListData> {
  const knownData: Array<KeyValueListData> = [];

  const dataKeys = Object.keys(data);
  for (const key of dataKeys) {
    const knownDataDetails = getOperatingSystemKnownDataDetails(
      data,
      key as OperatingSystemKnownDataType
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

export default getOperatingSystemKnownData;
