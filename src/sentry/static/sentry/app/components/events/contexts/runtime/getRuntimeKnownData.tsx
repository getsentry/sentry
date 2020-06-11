import {KeyValueListData} from 'app/components/events/interfaces/keyValueList/types';
import {getMeta} from 'app/components/events/meta/metaProxy';
import {defined} from 'app/utils';

import getRuntimeKnownDataDetails from './getRuntimeKnownDataDetails';
import {RuntimeData, RuntimeKnownDataType} from './types';

function getRuntimeKnownData(
  data: RuntimeData,
  runTimerKnownDataValues: Array<RuntimeKnownDataType>
): Array<KeyValueListData> {
  const knownData: Array<KeyValueListData> = [];

  const dataKeys = runTimerKnownDataValues.filter(runTimerKnownDataValue =>
    defined(data[runTimerKnownDataValue])
  );

  for (const key of dataKeys) {
    const knownDataDetails = getRuntimeKnownDataDetails(
      data,
      key as RuntimeKnownDataType
    );

    knownData.push({
      key,
      ...knownDataDetails,
      meta: getMeta(data, key),
    });
  }
  return knownData;
}

export default getRuntimeKnownData;
