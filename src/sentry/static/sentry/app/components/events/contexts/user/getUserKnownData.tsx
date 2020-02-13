import {KeyValueListData} from 'app/components/events/interfaces/keyValueList/keyValueListV2';
import {getMeta} from 'app/components/events/meta/metaProxy';
import {AvatarUser as UserType} from 'app/types';

import getUserKnownDataDetails, {
  UserKnownDataDetailsType,
} from './getUserKnownDataDetails';

function getUserKnownData(data: UserType): Array<KeyValueListData> {
  const knownData: Array<KeyValueListData> = [];

  const dataKeys = Object.keys(data);
  for (const key of dataKeys) {
    const knownDataDetails = getUserKnownDataDetails(
      data,
      key as UserKnownDataDetailsType
    );

    if (key === null || !knownDataDetails) {
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
