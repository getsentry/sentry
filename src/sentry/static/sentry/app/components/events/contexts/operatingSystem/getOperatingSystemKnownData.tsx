import {KeyValueListData} from 'app/components/events/interfaces/keyValueList/types';
import {getMeta} from 'app/components/events/meta/metaProxy';
import {defined} from 'app/utils';

import getOperatingSystemKnownDataDetails from './getOperatingSystemKnownDataDetails';
import {OperatingSystemKnownData, OperatingSystemKnownDataType} from './types';

function getOperatingSystemKnownData(
  data: OperatingSystemKnownData,
  operatingSystemKnownDataValues: Array<OperatingSystemKnownDataType>
): Array<KeyValueListData> {
  const knownData: Array<KeyValueListData> = [];

  const dataKeys = operatingSystemKnownDataValues.filter(operatingSystemKnownDataValue =>
    defined(data[operatingSystemKnownDataValue])
  );

  for (const key of dataKeys) {
    const knownDataDetails = getOperatingSystemKnownDataDetails(
      data,
      key as OperatingSystemKnownDataType
    );

    knownData.push({
      key,
      ...knownDataDetails,
      meta: getMeta(data, key),
    });
  }
  return knownData;
}

export default getOperatingSystemKnownData;
