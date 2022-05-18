import ErrorBoundary from 'sentry/components/errorBoundary';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';
import useOrganization from 'sentry/utils/useOrganization';

import getUnknownData from '../getUnknownData';

import getTraceKnownData from './getTraceKnownData';
import {TraceKnownData, TraceKnownDataType} from './types';

const traceKnownDataValues = [
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

function Trace({event, data}: Props) {
  const organization = useOrganization();

  return (
    <ErrorBoundary mini>
      <KeyValueList
        data={getTraceKnownData(data, traceKnownDataValues, event, organization)}
        isSorted={false}
        raw={false}
        isContextData
      />
      <KeyValueList
        data={getUnknownData(data, [...traceKnownDataValues, ...traceIgnoredDataValues])}
        isSorted={false}
        raw={false}
        isContextData
      />
    </ErrorBoundary>
  );
}

export default Trace;
