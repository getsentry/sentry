import {KeyValueListData} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';

import {getDeviceKnownDataDetails} from './getDeviceKnownDataDetails';
import {DeviceData} from './types';
import {deviceKnownDataValues} from '.';

type Props = {
  data: DeviceData;
  event: Event;
  meta: NonNullable<Event['_meta']>['user'];
};

export function getDeviceKnownData({data, event, meta}: Props): KeyValueListData {
  const knownData: KeyValueListData = [];

  const dataKeys = deviceKnownDataValues.filter(deviceKnownDataValue => {
    if (!defined(data[deviceKnownDataValue])) {
      if (meta[deviceKnownDataValue]) {
        return true;
      }
      return false;
    }
    return true;
  });

  for (const type of dataKeys) {
    const knownDataDetails = getDeviceKnownDataDetails({event, data, type});
    knownData.push({
      key: type,
      ...knownDataDetails,
      meta: meta[type]?.[''],
      subjectDataTestId: `device-context-${type.toLowerCase()}-value`,
    });
  }

  return knownData;
}
