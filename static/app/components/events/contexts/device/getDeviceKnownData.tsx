import {getMeta} from 'app/components/events/meta/metaProxy';
import {KeyValueListData} from 'app/types';
import {Event} from 'app/types/event';
import {defined} from 'app/utils';

import getDeviceKnownDataDetails from './getDeviceKnownDataDetails';
import {DeviceData, DeviceKnownDataType} from './types';

function getDeviceKnownData(
  event: Event,
  data: DeviceData,
  deviceKnownDataValues: Array<DeviceKnownDataType>
): KeyValueListData {
  const knownData: KeyValueListData = [];

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
      subjectDataTestId: `device-context-${key.toLowerCase()}-value`,
    });
  }

  return knownData;
}

export default getDeviceKnownData;
