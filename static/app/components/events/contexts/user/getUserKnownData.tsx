import {Event, KeyValueListData} from 'sentry/types';
import {defined} from 'sentry/utils';

import {getUserKnownDataDetails} from './getUserKnownDataDetails';
import {UserEventContextData, userKnownDataValues} from '.';

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
