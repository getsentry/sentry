import React from 'react';

import {Event, Organization} from 'app/types';
import {t} from 'app/locale';
import withOrganization from 'app/utils/withOrganization';
import ErrorBoundary from 'app/components/errorBoundary';
import KeyValueList from 'app/components/events/interfaces/keyValueList/keyValueListV2';

import {TraceKnownData, TraceKnownDataType} from './types';
import getTraceKnownData from './getTraceKnownData';

const traceKnownDataValues = [
  TraceKnownDataType.TRACE_ID,
  TraceKnownDataType.SPAN_ID,
  TraceKnownDataType.PARENT_SPAN_ID,
  TraceKnownDataType.OP_NAME,
  TraceKnownDataType.STATUS,
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
        raw={false}
      />
    </ErrorBoundary>
  );
});

const Trace = (props: Props) => {
  return <InnerTrace {...props} />;
};

Trace.getTitle = function() {
  return t('Trace Details');
};

export default Trace;
