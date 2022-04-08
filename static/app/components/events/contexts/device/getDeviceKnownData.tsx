import {getMeta} from 'sentry/components/events/meta/metaProxy';
import {KeyValueListData} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';

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
