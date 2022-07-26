import {KeyValueListData} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';

import {getAppKnownDataDetails} from './getAppKnownDataDetails';
import {AppData} from './types';
import {appKnownDataValues} from '.';

type Props = {
  data: AppData;
  event: Event;
  meta: NonNullable<Event['_meta']>['app'];
};

export function getAppKnownData({data, event, meta}: Props): KeyValueListData {
  const knownData: KeyValueListData = [];

  const dataKeys = appKnownDataValues.filter(appKnownDataValue => {
    if (!defined(data[appKnownDataValue])) {
      if (meta[appKnownDataValue]) {
        return true;
      }
      return false;
    }
    return true;
  });

  for (const type of dataKeys) {
    const knownDataDetails = getAppKnownDataDetails({event, data, type});

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
