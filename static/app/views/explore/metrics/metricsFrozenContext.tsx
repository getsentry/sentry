import type {ReactNode} from 'react';
import {createContext, useContext, useMemo} from 'react';

import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import type {DateString} from 'sentry/types/core';
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

const MetricsFrozenContext = createContext<MetricsFrozenContextValue | undefined>(
  undefined
);

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
function useMetricsFrozenContext(): Partial<MetricsFrozenContextValue> {
  return useContext(MetricsFrozenContext) ?? {};
}

export function useMetricsFrozenSearch() {
  return useMetricsFrozenContext().search;
}

export function useMetricsFrozenTracePeriod() {
  return useMetricsFrozenContext().tracePeriod;
}
