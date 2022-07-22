import startCase from 'lodash/startCase';

import {Event, KeyValueListData} from 'sentry/types';

type Props = {
  allData: Record<string, any>;
  knownKeys: string[];
  meta?: NonNullable<Event['_meta']>[keyof Event['_meta']];
};

export function getUnknownData({allData, knownKeys, meta}: Props): KeyValueListData {
  return Object.entries(allData)
    .filter(([key]) => key !== 'type' && key !== 'title')
    .filter(([key]) => !knownKeys.includes(key))
    .map(([key, value]) => ({
      key,
      value,
      subject: startCase(key),
      meta: meta[key]?.[''],
    }));
}
