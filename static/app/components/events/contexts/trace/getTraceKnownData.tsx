import {KeyValueListData, Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';

import {getTraceKnownDataDetails} from './getTraceKnownDataDetails';
import {TraceKnownData, TraceKnownDataType} from './types';
import {traceKnownDataValues} from '.';

type Props = {
  data: TraceKnownData;
  event: Event;
  meta: NonNullable<Event['_meta']>['trace'];
  organization: Organization;
};

export function getTraceKnownData({
  data,
  event,
  organization,
  meta,
}: Props): KeyValueListData {
  const knownData: KeyValueListData = [];

  const dataKeys = traceKnownDataValues.filter(traceKnownDataValue => {
    if (traceKnownDataValue === TraceKnownDataType.TRANSACTION_NAME) {
      return !!event?.tags.find(tag => {
        return tag.key === 'transaction';
      });
    }

    if (!defined(data[traceKnownDataValue])) {
      if (meta[traceKnownDataValue]) {
        return true;
      }
      return false;
    }
    return true;
  });

  for (const type of dataKeys) {
    const knownDataDetails = getTraceKnownDataDetails({data, type, event, organization});

    if (!knownDataDetails) {
      continue;
    }

    knownData.push({
      key: type,
      ...knownDataDetails,
      meta: meta[type]?.[''],
      subjectDataTestId: `trace-context-${type.toLowerCase()}-value`,
    });
  }

  return knownData;
}
