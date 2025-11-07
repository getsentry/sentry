import type {ReactNode} from 'react';
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

export interface MetricsFrozenForTracesProviderProps {
  traceIds: string[];
  children?: ReactNode;
  tracePeriod?: TracePeriod;
}

export function MetricsFrozenContextProvider(props: MetricsFrozenForTracesProviderProps) {
  const value: MetricsFrozenContextValue = useMemo(() => {
    if (props.traceIds.length) {
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

    return {frozen: false};
  }, [props]);

  return <MetricsFrozenContext value={value}>{props.children}</MetricsFrozenContext>;
}
function useMetricsFrozenContext() {
  return _useMetricsFrozenContext() ?? {};
}

export function useMetricsFrozenSearch() {
  return useMetricsFrozenContext().search;
}

export function useMetricsFrozenTracePeriod() {
  return useMetricsFrozenContext().tracePeriod;
}
