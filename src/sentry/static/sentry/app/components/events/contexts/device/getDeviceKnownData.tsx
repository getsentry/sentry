import {KeyValueListData} from 'app/components/events/interfaces/keyValueList/keyValueListV2';
import {getMeta} from 'app/components/events/meta/metaProxy';

import getDeviceKnownDataDetails, {
  DeviceKnownDataDetailsType,
  DeviceData,
} from './getDeviceKnownDataDetails';

function getOperatingSystemKnownData(data: DeviceData): Array<KeyValueListData> {
  const knownData: Array<KeyValueListData> = [];

  const dataKeys = Object.keys(data);
  for (const key of dataKeys) {
    const knownDataDetails = getDeviceKnownDataDetails(
      data,
      key as DeviceKnownDataDetailsType
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

export {DeviceData};
export default getOperatingSystemKnownData;
