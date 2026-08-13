import {createContext, useContext, useMemo} from 'react';

import {useOrganization} from 'sentry/utils/useOrganization';
import {isLogsEnabled} from 'sentry/views/explore/logs/isLogsEnabled';
import type {UseInfiniteLogsQueryResult} from 'sentry/views/explore/logs/useLogsQuery';
import {
  useInfiniteLogsQuery,
  useLogsQueryHighFidelity,
} from 'sentry/views/explore/logs/useLogsQuery';
import {useLogsTotalPayload} from 'sentry/views/explore/logs/useLogsTotalPayload';
import {useValidateLogsTab} from 'sentry/views/explore/logs/useValidateLogsTab';
import {
  getQueryValidationState,
  useLastSettledQueryResult,
} from 'sentry/views/explore/queryValidation';

interface LogsPageData {
  infiniteLogsQueryResult: UseInfiniteLogsQueryResult;
  preservePreviousData: boolean;
  queriesEnabled: boolean;
  totalPayloadBytes: number | undefined;
}

const LogsPageDataContext = createContext<LogsPageData | undefined>(undefined);

export function useLogsPageData(): LogsPageData {
  const context = useContext(LogsPageDataContext);
  if (context === undefined) {
    throw new Error(
      'useContext for "LogsPageDataContext" must be inside a Provider with a value'
    );
  }
  return context;
}

interface LogsPageDataProviderProps {
  children: React.ReactNode;
  allowHighFidelity?: boolean;
  disabled?: boolean;
  staleTime?: number;
  validateQuery?: boolean;
}

export function LogsPageDataProvider(props: LogsPageDataProviderProps) {
  if (props.validateQuery) {
    return <ValidatedLogsPageDataProvider {...props} />;
  }

  return (
    <LogsPageDataProviderInner {...props} preservePreviousData={false} queriesEnabled />
  );
}

function ValidatedLogsPageDataProvider(props: LogsPageDataProviderProps) {
  const validationResult = useValidateLogsTab();
  const {preservePreviousData, queriesEnabled} =
    getQueryValidationState(validationResult);

  return (
    <LogsPageDataProviderInner
      {...props}
      preservePreviousData={preservePreviousData}
      queriesEnabled={queriesEnabled}
      validationResult={validationResult}
    />
  );
}

function LogsPageDataProviderInner({
  children,
  allowHighFidelity,
  disabled,
  preservePreviousData,
  queriesEnabled,
  staleTime,
  validationResult,
}: LogsPageDataProviderProps & {
  preservePreviousData: boolean;
  queriesEnabled: boolean;
  validationResult?: Pick<ReturnType<typeof useValidateLogsTab>, 'error'>;
}) {
  const organization = useOrganization();
  const feature = isLogsEnabled(organization);
  const highFidelity = useLogsQueryHighFidelity();
  const queriedInfiniteLogsResult = useInfiniteLogsQuery({
    disabled: disabled || !feature || !queriesEnabled,
    highFidelity: allowHighFidelity && highFidelity,
    preservePreviousData,
    staleTime,
  });
  const preservedInfiniteLogsResult = useLastSettledQueryResult(
    queriedInfiniteLogsResult,
    queriedInfiniteLogsResult,
    queriesEnabled
  );
  const totalPayloadBytes = useLogsTotalPayload({
    enabled: !!(
      allowHighFidelity &&
      highFidelity &&
      feature &&
      !disabled &&
      queriesEnabled
    ),
  });
  const value = useMemo(() => {
    const infiniteLogsQueryResult = queriesEnabled
      ? queriedInfiniteLogsResult
      : preservePreviousData
        ? preservedInfiniteLogsResult
        : {
            ...queriedInfiniteLogsResult,
            data: [],
            error: validationResult?.error ?? null,
            isEmpty: !validationResult?.error,
            isError: !!validationResult?.error,
            isFetching: false,
            isPending: false,
            isRefetching: false,
            meta: {fields: {}, units: {}},
            refetch: queriedInfiniteLogsResult.refetch,
          };

    return {
      infiniteLogsQueryResult,
      preservePreviousData,
      queriesEnabled,
      totalPayloadBytes,
    };
  }, [
    preservePreviousData,
    preservedInfiniteLogsResult,
    queriedInfiniteLogsResult,
    queriesEnabled,
    totalPayloadBytes,
    validationResult?.error,
  ]);
  return <LogsPageDataContext value={value}>{children}</LogsPageDataContext>;
}

export function useLogsPageDataQueryResult() {
  const pageData = useLogsPageData();
  return {
    ...pageData.infiniteLogsQueryResult,
    totalPayloadBytes: pageData.totalPayloadBytes,
  };
}
