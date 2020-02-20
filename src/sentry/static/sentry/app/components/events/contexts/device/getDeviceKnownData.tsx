import {KeyValueListData} from 'app/components/events/interfaces/keyValueList/types';
import {getMeta} from 'app/components/events/meta/metaProxy';

import getDeviceKnownDataDetails from './getDeviceKnownDataDetails';
import {DeviceKnownDataType, DeviceData} from './types';

function getOperatingSystemKnownData(data: DeviceData): Array<KeyValueListData> {
  const knownData: Array<KeyValueListData> = [];

  const dataKeys = Object.keys(data);
  for (const key of dataKeys) {
    const knownDataDetails = getDeviceKnownDataDetails(data, key as DeviceKnownDataType);

    knownData.push({
      key,
      ...knownDataDetails,
      meta: getMeta(data, key),
    });
  }
  return knownData;
}

export default getOperatingSystemKnownData;
