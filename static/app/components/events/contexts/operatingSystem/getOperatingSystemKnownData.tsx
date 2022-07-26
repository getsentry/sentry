import {Event, KeyValueListData} from 'sentry/types';
import {defined} from 'sentry/utils';

import {getOperatingSystemKnownDataDetails} from './getOperatingSystemKnownDataDetails';
import {OperatingSystemKnownData} from './types';
import {operatingSystemKnownDataValues} from '.';

type Props = {
  data: OperatingSystemKnownData;
  meta: NonNullable<Event['_meta']>['os'];
};

export function getOperatingSystemKnownData({data, meta}: Props): KeyValueListData {
  const knownData: KeyValueListData = [];

  const dataKeys = operatingSystemKnownDataValues.filter(
    operatingSystemKnownDataValue => {
      if (!defined(data[operatingSystemKnownDataValue])) {
        if (meta[operatingSystemKnownDataValue]) {
          return true;
        }
        return false;
      }
      return true;
    }
  );

  for (const type of dataKeys) {
    const knownDataDetails = getOperatingSystemKnownDataDetails({data, type});

    if (!knownDataDetails) {
      continue;
    }

    knownData.push({
      key: type,
      ...knownDataDetails,
      meta: meta[type]?.[''],
    });
  }

  return knownData;
}
