import {KeyValueListData} from 'app/components/events/interfaces/keyValueList/types';
import {getMeta} from 'app/components/events/meta/metaProxy';

import getEventExtraDataKnownDataDetails from './getEventExtraDataKnownDataDetails';
import {EventExtraData, EventExtraDataType} from './types';

function getEventExtraDataKnownData(data: EventExtraData): Array<KeyValueListData> {
  const knownData: Array<KeyValueListData> = [];

  const dataKeys = Object.keys(data);
  for (const key of dataKeys) {
    const knownDataDetails = getEventExtraDataKnownDataDetails(
      data,
      key as EventExtraDataType
    );

    knownData.push({
      key,
      ...knownDataDetails,
      meta: getMeta(data, key),
    });
  }
  return knownData;
}

export default getEventExtraDataKnownData;
