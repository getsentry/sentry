import {KeyValueListData} from 'app/components/events/interfaces/keyValueList/keyValueListV2';
import {getMeta} from 'app/components/events/meta/metaProxy';

import getOperatingSystemKnownDataDetails, {
  OperatingSystemKnownDataDetailsType,
} from './getOperatingSystemKnownDataDetails';

export type Data = {
  name: string;
  type: string;
  build: string;
  kernel_version: string;
  version?: string;
  rooted?: any;
};

function getOperatingSystemKnownData(data: Data): Array<KeyValueListData> {
  const knownData: Array<KeyValueListData> = [];

  const dataKeys = Object.keys(data);
  for (const key of dataKeys) {
    const knownDataDetails = getOperatingSystemKnownDataDetails(
      data,
      key as OperatingSystemKnownDataDetailsType
    );

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

export default getOperatingSystemKnownData;
