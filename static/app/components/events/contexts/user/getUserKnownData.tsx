import {Event, KeyValueListData} from 'sentry/types';

import {getUserKnownDataDetails} from './getUserKnownDataDetails';
import {UserEventContextData, userKnownDataValues} from '.';

type Props = {
  data: UserEventContextData;
  meta: NonNullable<Event['_meta']>['user'];
};

export function getUserKnownData({data, meta}: Props): KeyValueListData {
  const knownData: KeyValueListData = [];

  const dataKeys = userKnownDataValues.filter(userKnownDataValue => {
    if (
      typeof data[userKnownDataValue] !== 'number' &&
      typeof data[userKnownDataValue] !== 'boolean' &&
      !data[userKnownDataValue]
    ) {
      return !!meta[userKnownDataValue];
    }
    return true;
  });

  for (const type of dataKeys) {
    const knownDataDetails = getUserKnownDataDetails({
      data,
      type,
    });

    if (!knownDataDetails) {
      continue;
    }

    knownData.push({
      key: type,
      ...knownDataDetails,
      meta: meta[type]?.[''],
      subjectDataTestId: `user-context-${type.toLowerCase()}-value`,
    });
  }

  return knownData;
}
