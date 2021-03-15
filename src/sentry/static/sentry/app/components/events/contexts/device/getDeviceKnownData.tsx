import {KeyValueListData} from 'app/components/events/interfaces/keyValueList/types';
import {getMeta} from 'app/components/events/meta/metaProxy';
import {Event} from 'app/types/event';
import {defined} from 'app/utils';

import getDeviceKnownDataDetails from './getDeviceKnownDataDetails';
import {DeviceData, DeviceKnownDataType} from './types';

function getOperatingSystemKnownData(
  event: Event,
  data: DeviceData,
  deviceKnownDataValues: Array<DeviceKnownDataType>
): Array<KeyValueListData> {
  const knownData: Array<KeyValueListData> = [];

  const dataKeys = deviceKnownDataValues.filter(deviceKnownDataValue =>
    defined(data[deviceKnownDataValue])
  );

  for (const key of dataKeys) {
    const knownDataDetails = getDeviceKnownDataDetails(
      event,
      data,
      key as DeviceKnownDataType
    );

    knownData.push({
      key,
      ...knownDataDetails,
      meta: getMeta(data, key as keyof DeviceData),
    });
  }

  return knownData;
}

export default getOperatingSystemKnownData;
