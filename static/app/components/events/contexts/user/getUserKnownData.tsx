import {Event, KeyValueListData} from 'sentry/types';
import {defined} from 'sentry/utils';

import {getUserKnownDataDetails} from './getUserKnownDataDetails';
import {UserEventContextData, UserKnownDataType, userKnownDataValues} from '.';

type Props = {
  data: UserEventContextData;
  meta: NonNullable<Event['_meta']>['user'];
};

export function getUserKnownData({data, meta}: Props): KeyValueListData {
  const knownData: KeyValueListData = [];

  const dataKeys = userKnownDataValues.filter(userKnownDataValue => {
    if (!defined(data[userKnownDataValue])) {
      if (meta[userKnownDataValue]) {
        return true;
      }
      return false;
    }
    return true;
  });

  for (const key of dataKeys) {
    const knownDataDetails = getUserKnownDataDetails({
      data,
      type: key as UserKnownDataType,
    });

    if (!knownDataDetails) {
      continue;
    }

    knownData.push({
      key,
      ...knownDataDetails,
      meta: meta[key]?.[''],
      subjectDataTestId: `user-context-${key.toLowerCase()}-value`,
    });
  }

  return knownData;
}
