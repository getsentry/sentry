import {KeyValueListData} from 'app/components/events/interfaces/keyValueList/types';
import {getMeta} from 'app/components/events/meta/metaProxy';

function getUnknownData(
  allData: Record<string, any>,
  knownKeys: string[]
): KeyValueListData[] {
  return Object.entries(allData)
    .filter(([key]) => key !== 'type' && key !== 'title')
    .filter(([key]) => !knownKeys.includes(key))
    .map(([key, value]) => ({
      key,
      value,
      subject: key,
      meta: getMeta(allData, key),
    }));
}

export default getUnknownData;
