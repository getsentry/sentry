import {Event, KeyValueListData} from 'sentry/types';
import {defined} from 'sentry/utils';

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
    if (!defined(data[runTimerKnownDataValue])) {
      if (meta[runTimerKnownDataValue]) {
        return true;
      }
      return false;
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
