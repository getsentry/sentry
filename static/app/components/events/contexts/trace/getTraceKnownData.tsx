import {getMeta} from 'app/components/events/meta/metaProxy';
import {KeyValueListData, Organization} from 'app/types';
import {Event} from 'app/types/event';
import {defined} from 'app/utils';

import getTraceKnownDataDetails from './getTraceKnownDataDetails';
import {TraceKnownData, TraceKnownDataType} from './types';

type TraceKnownDataKeys = Extract<keyof TraceKnownData, string>;

function getTraceKnownData(
  data: TraceKnownData,
  traceKnownDataValues: Array<TraceKnownDataType>,
  event: Event,
  organization: Organization
): KeyValueListData {
  const knownData: KeyValueListData = [];

  const dataKeys = traceKnownDataValues.filter(traceKnownDataValue => {
    if (traceKnownDataValue === TraceKnownDataType.TRANSACTION_NAME) {
      return event?.tags.find(tag => {
        return tag.key === 'transaction';
      });
    }

    return data[traceKnownDataValue];
  });

  for (const key of dataKeys) {
    const knownDataDetails = getTraceKnownDataDetails(data, key, event, organization);

    if ((knownDataDetails && !defined(knownDataDetails.value)) || !knownDataDetails) {
      continue;
    }

    knownData.push({
      key,
      ...knownDataDetails,
      meta: getMeta(data, key as TraceKnownDataKeys),
      subjectDataTestId: `trace-context-${key.toLowerCase()}-value`,
    });
  }

  return knownData;
}

export default getTraceKnownData;
