import {getMeta} from 'app/components/events/meta/metaProxy';
import {KeyValueListData} from 'app/types';
import {defined} from 'app/utils';

import getBrowserKnownDataDetails from './getBrowserKnownDataDetails';
import {BrowserKnownData, BrowserKnownDataType} from './types';

function getBrowserKnownData(
  data: BrowserKnownData,
  operatingSystemKnownDataValues: Array<BrowserKnownDataType>
): KeyValueListData {
  const knownData: KeyValueListData = [];

  const dataKeys = operatingSystemKnownDataValues.filter(operatingSystemKnownDataValue =>
    defined(data[operatingSystemKnownDataValue])
  );

  for (const key of dataKeys) {
    const knownDataDetails = getBrowserKnownDataDetails(
      data,
      key as BrowserKnownDataType
    );

    knownData.push({
      key,
      ...knownDataDetails,
      meta: getMeta(data, key),
    });
  }
  return knownData;
}

export default getBrowserKnownData;
