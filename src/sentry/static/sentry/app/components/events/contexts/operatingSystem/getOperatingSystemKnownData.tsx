import {KeyValueListData} from 'app/components/events/interfaces/keyValueList/keyValueListV2';
import {getMeta} from 'app/components/events/meta/metaProxy';

import getOperatingSystemKnownDataDetails, {
  OperatingSystemKnownData,
  OperatingSystemKnownDataDetailsType,
} from './getOperatingSystemKnownDataDetails';

function getOperatingSystemKnownData(
  data: OperatingSystemKnownData
): Array<KeyValueListData> {
  const knownData: Array<KeyValueListData> = [];

  const dataKeys = Object.keys(data);
  for (const key of dataKeys) {
    const knownDataDetails = getOperatingSystemKnownDataDetails(
      data,
      key as OperatingSystemKnownDataDetailsType
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

export {OperatingSystemKnownData};
export default getOperatingSystemKnownData;
