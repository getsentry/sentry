import type {Location} from 'history';

import ErrorBoundary from 'sentry/components/errorBoundary';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import type {Event} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

import {
  getContextMeta,
  getKnownData,
  getKnownStructuredData,
  getUnknownData,
} from '../utils';

import {getTraceKnownDataDetails} from './getTraceKnownDataDetails';
import type {TraceKnownData} from './types';
import {TraceKnownDataType} from './types';

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
  location: Location;
  meta?: Record<string, any>;
};

export function getKnownTraceContextData({
  data,
  event,
  meta,
  organization,
  location,
}: Props & {
  organization: Organization;
}) {
  return getKnownData<TraceKnownData, TraceKnownDataType>({
    data,
    meta,
    knownDataTypes: traceKnownDataValues,
    onGetKnownDataDetails: v =>
      getTraceKnownDataDetails({...v, organization, event, location}),
  }).map(v => ({
    ...v,
    subjectDataTestId: `trace-context-${v.key.toLowerCase()}-value`,
  }));
}

export function getUnknownTraceContextData({data, meta}: Pick<Props, 'data' | 'meta'>) {
  return getUnknownData({
    allData: data,
    knownKeys: [...traceKnownDataValues, ...traceIgnoredDataValues],
    meta,
  });
}

export function TraceEventContext({event, data, meta: propsMeta}: Props) {
  const organization = useOrganization();
  const location = useLocation();
  const meta = propsMeta ?? getContextMeta(event, 'trace');
  const knownData = getKnownTraceContextData({data, event, meta, organization, location});
  const knownStructuredData = getKnownStructuredData(knownData, meta);
  const unknownData = getUnknownTraceContextData({data, meta});

  return (
    <ErrorBoundary mini>
      <KeyValueList
        data={knownStructuredData}
        shouldSort={false}
        raw={false}
        isContextData
      />
      <KeyValueList data={unknownData} shouldSort={false} raw={false} isContextData />
    </ErrorBoundary>
  );
}
