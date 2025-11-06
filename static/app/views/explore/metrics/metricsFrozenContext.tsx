import type {DateString} from 'sentry/types/core';
import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';

interface TracePeriod {
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

const [_MetricsFrozenContextProvider, _useMetricsFrozenContext] =
  createDefinedContext<MetricsFrozenContextValue>({
    name: 'MetricsFrozenContext',
    strict: false,
  });

function useMetricsFrozenContext() {
  return _useMetricsFrozenContext() ?? {};
}

export function useMetricsFrozenSearch() {
  return useMetricsFrozenContext().search;
}

export function useMetricsFrozenTracePeriod() {
  return useMetricsFrozenContext().tracePeriod;
}
