import type {ReactNode, ReactPortal} from 'react';
import {useMemo} from 'react';

import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

interface LogsFrozenContextValue {
  frozen: boolean;
  projectIds?: number[];
  replayEndedAt?: Date;
  replayId?: string;
  replayStartedAt?: Date;
  search?: MutableSearch;
  spanId?: string;
  traceIds?: string[];
}

const [_LogsFrozenContextProvider, _useLogsFrozenContext, LogsFrozenContext] =
  createDefinedContext<LogsFrozenContextValue>({
    name: 'LogsFrozenContext',
    strict: false,
  });

interface LogsFrozenForTracesProviderProps {
  traceIds: string[];
}

interface LogsFrozenForTraceProviderProps {
  traceId: string;
}

interface LogsFrozenForSpanProviderProps {
  span: {
    spanId: string;
    traceId: string;
    projectIds?: number[];
  };
}

interface LogsFrozenForReplayProviderProps {
  replayId: string;
  replayStartedAt: Date;
  replayEndedAt?: Date;
}

type LogsNotFrozenProviderProps = Record<keyof any, never>;

export type LogsFrozenContextProviderProps =
  | LogsFrozenForTracesProviderProps
  | LogsFrozenForTraceProviderProps
  | LogsFrozenForSpanProviderProps
  | LogsFrozenForReplayProviderProps
  | LogsNotFrozenProviderProps;

interface LogsFrozenForTracesProviderWithChildrenProps
  extends ReactPortal, LogsFrozenForTracesProviderProps {}

interface LogsFrozenForTraceProviderWithChildrenProps
  extends ReactPortal, LogsFrozenForTraceProviderProps {}

interface LogsFrozenForSpanProviderWithChildrenProps
  extends ReactPortal, LogsFrozenForSpanProviderProps {}

interface LogsFrozenForReplayProviderWithChildrenProps
  extends ReactPortal, LogsFrozenForReplayProviderProps {}

type LogsFrozenContextProviderWithChildrenProps =
  | LogsFrozenForTracesProviderWithChildrenProps
  | LogsFrozenForTraceProviderWithChildrenProps
  | LogsFrozenForSpanProviderWithChildrenProps
  | LogsFrozenForReplayProviderWithChildrenProps
  | {children: ReactNode};

function isLogsFrozenForTracesProviderWithChildrenProps(
  value: LogsFrozenContextProviderWithChildrenProps
): value is LogsFrozenForTracesProviderWithChildrenProps {
  return value.hasOwnProperty('traceIds');
}

function isLogsFrozenForTraceProviderWithChildrenProps(
  value: LogsFrozenContextProviderWithChildrenProps
): value is LogsFrozenForTraceProviderWithChildrenProps {
  return value.hasOwnProperty('traceId');
}

function isLogsFrozenForSpanProviderWithChildrenProps(
  value: LogsFrozenContextProviderWithChildrenProps
): value is LogsFrozenForSpanProviderWithChildrenProps {
  return value.hasOwnProperty('span');
}

function isLogsFrozenForReplayProviderWithChildrenProps(
  value: LogsFrozenContextProviderWithChildrenProps
): value is LogsFrozenForReplayProviderWithChildrenProps {
  return value.hasOwnProperty('replayId');
}

export function LogsFrozenContextProvider(
  props: LogsFrozenContextProviderWithChildrenProps
) {
  const value: LogsFrozenContextValue = useMemo(() => {
    if (isLogsFrozenForTracesProviderWithChildrenProps(props) && props.traceIds.length) {
      const search = new MutableSearch('');
      const traceIds = `[${props.traceIds.join(',')}]`;
      search.addFilterValue(OurLogKnownFieldKey.TRACE_ID, traceIds);
      return {
        frozen: true,
        search,
        traceIds: props.traceIds,
        projectIds: [ALL_ACCESS_PROJECTS],
      };
    }

    if (isLogsFrozenForTraceProviderWithChildrenProps(props)) {
      const search = new MutableSearch('');
      search.addFilterValue(OurLogKnownFieldKey.TRACE_ID, props.traceId);
      return {
        frozen: true,
        search,
        traceIds: [props.traceId],
        projectIds: [ALL_ACCESS_PROJECTS],
      };
    }

    if (isLogsFrozenForSpanProviderWithChildrenProps(props)) {
      const search = new MutableSearch('');
      search.addFilterValue(OurLogKnownFieldKey.TRACE_ID, props.span.traceId);
      search.addFilterValue(OurLogKnownFieldKey.PARENT_SPAN_ID, props.span.spanId);
      return {
        frozen: true,
        search,
        traceIds: [props.span.traceId],
        projectIds: props.span.projectIds ?? [ALL_ACCESS_PROJECTS],
      };
    }

    if (isLogsFrozenForReplayProviderWithChildrenProps(props)) {
      const search = new MutableSearch('');
      search.addFilterValue(OurLogKnownFieldKey.REPLAY_ID, props.replayId);
      return {
        frozen: true,
        search,
        replayId: props.replayId,
        projectIds: [ALL_ACCESS_PROJECTS],
        replayStartedAt: props.replayStartedAt,
        replayEndedAt: props.replayEndedAt,
      };
    }

    return {frozen: false};
  }, [props]);

  return <LogsFrozenContext value={value}>{props.children}</LogsFrozenContext>;
}

function useLogsFrozenContext() {
  // default to `LogsNotFrozen`
  return _useLogsFrozenContext() ?? {};
}

export function useLogsFrozenIsFrozen() {
  return useLogsFrozenContext().frozen;
}

export function useLogsFrozenProjectIds() {
  return useLogsFrozenContext().projectIds;
}

export function useLogsFrozenTraceIds() {
  return useLogsFrozenContext().traceIds;
}

export function useLogsFrozenReplayInfo() {
  return {
    replayId: useLogsFrozenContext().replayId,
    replayStartedAt: useLogsFrozenContext().replayStartedAt,
    replayEndedAt: useLogsFrozenContext().replayEndedAt,
  };
}

export function useLogsFrozenSearch() {
  return useLogsFrozenContext().search;
}
