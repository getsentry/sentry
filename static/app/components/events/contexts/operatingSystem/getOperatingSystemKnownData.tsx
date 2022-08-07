import {Event, KeyValueListData} from 'sentry/types';

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
      if (
        typeof data[operatingSystemKnownDataValue] !== 'number' &&
        !data[operatingSystemKnownDataValue]
      ) {
        return !!meta[operatingSystemKnownDataValue];
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
