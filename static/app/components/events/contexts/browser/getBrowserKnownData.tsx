import {Event, KeyValueListData} from 'sentry/types';

import {getBrowserKnownDataDetails} from './getBrowserKnownDataDetails';
import {BrowserKnownData} from './types';
import {browserKnownDataValues} from '.';

type Props = {
  data: BrowserKnownData;
  meta: NonNullable<Event['_meta']>['browser'];
};

export function getBrowserKnownData({data, meta}: Props): KeyValueListData {
  const knownData: KeyValueListData = [];

  const dataKeys = browserKnownDataValues.filter(browserKnownDataValue => {
    if (typeof data[browserKnownDataValue] !== 'number' && !data[browserKnownDataValue]) {
      return !!meta[browserKnownDataValue];
    }
    return true;
  });

  for (const type of dataKeys) {
    const knownDataDetails = getBrowserKnownDataDetails({data, type});

    if (!knownDataDetails) {
      continue;
    }

    knownData.push({
      key: type,
      ...knownDataDetails,
      meta: meta[type]?.[''],
    });
  }

  return knownData;
}
