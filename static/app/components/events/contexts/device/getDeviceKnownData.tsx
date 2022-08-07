import {KeyValueListData} from 'sentry/types';
import {Event} from 'sentry/types/event';

import {getDeviceKnownDataDetails} from './getDeviceKnownDataDetails';
import {DeviceData} from './types';
import {deviceKnownDataValues} from '.';

type Props = {
  data: DeviceData;
  event: Event;
  meta: NonNullable<Event['_meta']>['device'];
};

export function getDeviceKnownData({data, event, meta}: Props): KeyValueListData {
  const knownData: KeyValueListData = [];

  const dataKeys = deviceKnownDataValues.filter(deviceKnownDataValue => {
    if (typeof data[deviceKnownDataValue] !== 'number' && !data[deviceKnownDataValue]) {
      return !!meta[deviceKnownDataValue];
    }
    return true;
  });

  for (const type of dataKeys) {
    const knownDataDetails = getDeviceKnownDataDetails({event, data, type});

    if (!knownDataDetails) {
      continue;
    }

    knownData.push({
      key: type,
      ...knownDataDetails,
      meta: meta[type]?.[''],
      subjectDataTestId: `device-context-${type.toLowerCase()}-value`,
    });
  }

  return knownData;
}
