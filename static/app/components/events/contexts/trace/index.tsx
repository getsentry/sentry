import ErrorBoundary from 'sentry/components/errorBoundary';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';
import useOrganization from 'sentry/utils/useOrganization';

import {getUnknownData} from '../getUnknownData';

import {getTraceKnownData} from './getTraceKnownData';
import {TraceKnownData, TraceKnownDataType} from './types';

export const traceKnownDataValues = [
  TraceKnownDataType.STATUS,
  TraceKnownDataType.TRACE_ID,
  TraceKnownDataType.SPAN_ID,
  TraceKnownDataType.PARENT_SPAN_ID,
  TraceKnownDataType.TRANSACTION_NAME,
  TraceKnownDataType.OP_NAME,
];

const traceIgnoredDataValues = [];

type Props = {
  data: TraceKnownData & Record<string, any>;
  event: Event;
  organization: Organization;
};

export function TraceEventContext({event, data}: Props) {
  const organization = useOrganization();
  const meta = event._meta?.trace ?? {};

  return (
    <ErrorBoundary mini>
      <KeyValueList
        data={getTraceKnownData({data, meta, event, organization})}
        isSorted={false}
        raw={false}
        isContextData
      />
      <KeyValueList
        data={getUnknownData({
          allData: data,
          knownKeys: [...traceKnownDataValues, ...traceIgnoredDataValues],
          meta,
        })}
        isSorted={false}
        raw={false}
        isContextData
      />
    </ErrorBoundary>
  );
}
