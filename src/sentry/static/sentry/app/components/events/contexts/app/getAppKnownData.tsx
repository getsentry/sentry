import {KeyValueListData} from 'app/components/events/interfaces/keyValueList/keyValueListV2';
import {getMeta} from 'app/components/events/meta/metaProxy';

import getAppKnownDataDetails, {
  AppData,
  AppKnownDataDetailsType,
} from './getAppKnownDataDetails';

function getAppKnownData(data: AppData): Array<KeyValueListData> {
  const knownData: Array<KeyValueListData> = [];

  const dataKeys = Object.keys(data);
  for (const key of dataKeys) {
    const knownDataDetails = getAppKnownDataDetails(data, key as AppKnownDataDetailsType);

    if (key === null || !knownDataDetails) {
      continue;
    }

    knownData.push({
      key,
      ...knownDataDetails,
      meta: getMeta(data, key),
    });
  }
  return knownData;
}

export {AppData};
export default getAppKnownData;
