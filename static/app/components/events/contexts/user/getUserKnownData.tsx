import {AvatarUser as UserType, Event, KeyValueListData} from 'sentry/types';
import {defined} from 'sentry/utils';

import {getUserKnownDataDetails} from './getUserKnownDataDetails';
import {UserKnownDataType} from '.';

type Props = {
  data: UserType;
  meta: NonNullable<Event['_meta']>['user'];
  userKnownDataValues: Array<UserKnownDataType>;
};

export function getUserKnownData({
  data,
  userKnownDataValues,
  meta,
}: Props): KeyValueListData {
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
    const knownDataDetails = getUserKnownDataDetails(data, key as UserKnownDataType);

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
