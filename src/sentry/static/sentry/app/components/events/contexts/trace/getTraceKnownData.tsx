import {Event, Organization} from 'app/types';
import {defined} from 'app/utils';
import {KeyValueListData} from 'app/components/events/interfaces/keyValueList/types';
import {getMeta} from 'app/components/events/meta/metaProxy';

import {TraceKnownData, TraceKnownDataType} from './types';
import getUserKnownDataDetails from './getTraceKnownDataDetails';

type TraceKnownDataKeys = Extract<keyof TraceKnownData, string>;

function getTraceKnownData(
  data: TraceKnownData,
  traceKnownDataValues: Array<TraceKnownDataType>,
  event: Event,
  organization: Organization
): Array<KeyValueListData> {
  const knownData: Array<KeyValueListData> = [];

  const dataKeys = traceKnownDataValues.filter(traceKnownDataValue => {
    if (traceKnownDataValue === TraceKnownDataType.TRANSACTION_NAME) {
      return event?.tags.find(tag => {
        return tag.key === 'transaction';
      });
    }

    return data[traceKnownDataValue];
  });

  for (const key of dataKeys) {
    const knownDataDetails = getUserKnownDataDetails(data, key, event, organization);

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
