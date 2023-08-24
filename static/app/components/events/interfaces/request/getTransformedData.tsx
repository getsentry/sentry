import {
  getChildMetaContainer,
  MetaContainer,
} from 'sentry/components/events/meta/metaContainer';
import {EntryRequest} from 'sentry/types';

type KeyValue = [key: any, value: any];

function getTransformedData(
  data: EntryRequest['data']['data'],
  meta: MetaContainer
): Array<{data: KeyValue; meta: MetaContainer}> {
  if (Array.isArray(data)) {
    return data.flatMap((dataValue, index: number) => {
      if (Array.isArray(dataValue)) {
        return [
          {
            data: [dataValue[0], dataValue[1]] satisfies KeyValue,
            meta: getChildMetaContainer(meta, index),
          },
        ];
      }
      // Unexpected scenario given `EntryRequest['data']['data']` type.
      return [];
    });
  }

  if (data !== null && typeof data === 'object') {
    return Object.keys(data).map(key => ({
      data: [key, data[key]],
      meta: getChildMetaContainer(meta, key),
    }));
  }

  return [];
}

export default getTransformedData;
