import type {ReactNode, ReactPortal} from 'react';
import {useMemo} from 'react';

import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import type {DateString} from 'sentry/types/core';
import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {TraceMetricKnownFieldKey} from 'sentry/views/explore/metrics/types';

export interface TracePeriod {
  end?: DateString;
  period?: string | null;
  start?: DateString;
}

interface MetricsFrozenContextValue {
  frozen: boolean;
  projectIds?: number[];
  search?: MutableSearch;
  traceIds?: string[];
  tracePeriod?: TracePeriod;
}

const [_MetricsFrozenContextProvider, _useMetricsFrozenContext, MetricsFrozenContext] =
  createDefinedContext<MetricsFrozenContextValue>({
    name: 'MetricsFrozenContext',
    strict: false,
  });

interface MetricsFrozenForTracesProviderProps {
  traceIds: string[];
  tracePeriod?: TracePeriod;
}

interface MetricsFrozenForTraceProviderProps {
  traceId: string;
  tracePeriod?: TracePeriod;
}

type MetricsNotFrozenProviderProps = Record<keyof any, never>;

export type MetricsFrozenContextProviderProps =
  | MetricsFrozenForTracesProviderProps
  | MetricsFrozenForTraceProviderProps
  | MetricsNotFrozenProviderProps;

interface MetricsFrozenForTracesProviderWithChildrenProps
  extends ReactPortal,
    MetricsFrozenForTracesProviderProps {}

interface MetricsFrozenForTraceProviderWithChildrenProps
  extends ReactPortal,
    MetricsFrozenForTraceProviderProps {}

type MetricsFrozenContextProviderWithChildrenProps =
  | MetricsFrozenForTracesProviderWithChildrenProps
  | MetricsFrozenForTraceProviderWithChildrenProps
  | {children: ReactNode};

function isMetricsFrozenForTracesProviderWithChildrenProps(
  value: MetricsFrozenContextProviderWithChildrenProps
): value is MetricsFrozenForTracesProviderWithChildrenProps {
  return value.hasOwnProperty('traceIds');
}

function isMetricsFrozenForTraceProviderWithChildrenProps(
  value: MetricsFrozenContextProviderWithChildrenProps
): value is MetricsFrozenForTraceProviderWithChildrenProps {
  return value.hasOwnProperty('traceId');
}

export function MetricsFrozenContextProvider(
  props: MetricsFrozenContextProviderWithChildrenProps
) {
  const value: MetricsFrozenContextValue = useMemo(() => {
    if (
      isMetricsFrozenForTracesProviderWithChildrenProps(props) &&
      props.traceIds.length
    ) {
      const search = new MutableSearch('');
      const traceIds = `[${props.traceIds.join(',')}]`;
      search.addFilterValue(TraceMetricKnownFieldKey.TRACE, traceIds);
      return {
        frozen: true,
        search,
        traceIds: props.traceIds,
        projectIds: [ALL_ACCESS_PROJECTS],
        tracePeriod: props.tracePeriod,
      };
    }

    if (isMetricsFrozenForTraceProviderWithChildrenProps(props)) {
      const search = new MutableSearch('');
      search.addFilterValue(TraceMetricKnownFieldKey.TRACE, props.traceId);
      return {
        frozen: true,
        search,
        traceIds: [props.traceId],
        projectIds: [ALL_ACCESS_PROJECTS],
        tracePeriod: props.tracePeriod,
      };
    }

    return {frozen: false};
  }, [props]);

  return <MetricsFrozenContext value={value}>{props.children}</MetricsFrozenContext>;
}

function useMetricsFrozenContext() {
  return _useMetricsFrozenContext() ?? {};
}

export function useMetricsFrozenIsFrozen() {
  return useMetricsFrozenContext().frozen;
}

export function useMetricsFrozenProjectIds() {
  return useMetricsFrozenContext().projectIds;
}

export function useMetricsFrozenTraceIds() {
  return useMetricsFrozenContext().traceIds;
}

export function useMetricsFrozenSearch() {
  return useMetricsFrozenContext().search;
}

export function useMetricsFrozenTracePeriod() {
  return useMetricsFrozenContext().tracePeriod;
}
