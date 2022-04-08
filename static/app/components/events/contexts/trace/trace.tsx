import ErrorBoundary from 'sentry/components/errorBoundary';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';
import withOrganization from 'sentry/utils/withOrganization';

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
  data: TraceKnownData;
  event: Event;
  organization: Organization;
};

const InnerTrace = withOrganization(function ({organization, event, data}: Props) {
  return (
    <ErrorBoundary mini>
      <KeyValueList
        data={getTraceKnownData(data, traceKnownDataValues, event, organization)}
        isSorted={false}
        raw={false}
      />
      <KeyValueList
        data={getUnknownData(data, [...traceKnownDataValues, ...traceIgnoredDataValues])}
        isSorted={false}
        raw={false}
      />
    </ErrorBoundary>
  );
});

const Trace = (props: Props) => {
  return <InnerTrace {...props} />;
};

export default Trace;
