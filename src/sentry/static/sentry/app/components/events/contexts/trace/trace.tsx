import React from 'react';

import {Event, Organization} from 'app/types';
import withOrganization from 'app/utils/withOrganization';
import ErrorBoundary from 'app/components/errorBoundary';
import KeyValueList from 'app/components/events/interfaces/keyValueList/keyValueListV2';

import {TraceKnownData, TraceKnownDataType} from './types';
import getTraceKnownData from './getTraceKnownData';

const traceKnownDataValues = [
  TraceKnownDataType.STATUS,
  TraceKnownDataType.TRACE_ID,
  TraceKnownDataType.SPAN_ID,
  TraceKnownDataType.PARENT_SPAN_ID,
  TraceKnownDataType.TRANSACTION_NAME,
  TraceKnownDataType.OP_NAME,
];

type Props = {
  organization: Organization;
  event: Event;
  data: TraceKnownData;
};

const InnerTrace = withOrganization(function({organization, event, data}: Props) {
  return (
    <ErrorBoundary mini>
      <KeyValueList
        data={getTraceKnownData(data, traceKnownDataValues, event, organization)}
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
