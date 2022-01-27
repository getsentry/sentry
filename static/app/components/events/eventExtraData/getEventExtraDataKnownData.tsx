import {getMeta} from 'sentry/components/events/meta/metaProxy';
import {KeyValueListData} from 'sentry/types';

import getEventExtraDataKnownDataDetails from './getEventExtraDataKnownDataDetails';
import {EventExtraData, EventExtraDataType} from './types';

function getEventExtraDataKnownData(data: EventExtraData): KeyValueListData {
  const knownData: KeyValueListData = [];

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
