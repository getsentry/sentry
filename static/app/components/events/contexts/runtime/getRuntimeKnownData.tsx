import {Event, KeyValueListData} from 'sentry/types';

import {getRuntimeKnownDataDetails} from './getRuntimeKnownDataDetails';
import {runtimeKnownDataValues} from './index';
import {RuntimeData} from './types';

type Props = {
  data: RuntimeData;
  meta: NonNullable<Event['_meta']>['runtime'];
};

export function getRuntimeKnownData({data, meta}: Props): KeyValueListData {
  const knownData: KeyValueListData = [];

  const dataKeys = runtimeKnownDataValues.filter(runTimerKnownDataValue => {
    if (
      typeof data[runTimerKnownDataValue] !== 'number' &&
      typeof data[runTimerKnownDataValue] !== 'boolean' &&
      !data[runTimerKnownDataValue]
    ) {
      return !!meta[runTimerKnownDataValue];
    }
    return true;
  });

  for (const type of dataKeys) {
    const knownDataDetails = getRuntimeKnownDataDetails({data, type});

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
