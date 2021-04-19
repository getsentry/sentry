import {getMeta} from 'app/components/events/meta/metaProxy';
import {KeyValueListData} from 'app/types';
import {Event} from 'app/types/event';
import {defined} from 'app/utils';

import getAppKnownDataDetails from './getAppKnownDataDetails';
import {AppData, AppKnownDataType} from './types';

function getAppKnownData(
  event: Event,
  data: AppData,
  appKnownDataValues: Array<AppKnownDataType>
): KeyValueListData {
  const knownData: KeyValueListData = [];

  const dataKeys = appKnownDataValues.filter(appKnownDataValue =>
    defined(data[appKnownDataValue])
  );

  for (const key of dataKeys) {
    const knownDataDetails = getAppKnownDataDetails(event, data, key as AppKnownDataType);

    knownData.push({
      key,
      ...knownDataDetails,
      meta: getMeta(data, key),
    });
  }
  return knownData;
}

export default getAppKnownData;
