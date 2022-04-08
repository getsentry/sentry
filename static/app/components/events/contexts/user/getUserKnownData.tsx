import {getMeta} from 'sentry/components/events/meta/metaProxy';
import {AvatarUser as UserType, KeyValueListData} from 'sentry/types';
import {defined} from 'sentry/utils';

import getUserKnownDataDetails from './getUserKnownDataDetails';
import {UserKnownDataType} from './types';

function getUserKnownData(
  data: UserType,
  userKnownDataValues: Array<UserKnownDataType>
): KeyValueListData {
  const knownData: KeyValueListData = [];

  const dataKeys = userKnownDataValues.filter(userKnownDataValue =>
    defined(data[userKnownDataValue])
  );

  for (const key of dataKeys) {
    const knownDataDetails = getUserKnownDataDetails(data, key as UserKnownDataType);
    if ((knownDataDetails && !defined(knownDataDetails.value)) || !knownDataDetails) {
      continue;
    }
    knownData.push({
      key,
      ...knownDataDetails,
      meta: getMeta(data, key),
      subjectDataTestId: `user-context-${key.toLowerCase()}-value`,
    });
  }
  return knownData;
}

export default getUserKnownData;
