import {KeyValueListData} from 'app/components/events/interfaces/keyValueList/types';
import {getMeta} from 'app/components/events/meta/metaProxy';
import {AvatarUser as UserType} from 'app/types';
import {defined} from 'app/utils';

import getUserKnownDataDetails from './getUserKnownDataDetails';
import {UserKnownDataType} from './types';

function getUserKnownData(data: UserType): Array<KeyValueListData> {
  const knownData: Array<KeyValueListData> = [];

  const dataKeys = Object.keys(data);
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
