import useOrganization from 'sentry/utils/useOrganization';

interface QueryProps {
  enabled: boolean;
  query: string;
  queryExtras?: Record<string, any>;
}

interface QueryResult<T> {
  canUsePreviousResults: boolean;
  result: T;
}

interface ProgressiveQueryOptions<T> {
  enabled: boolean;
  query: string;
  useQueryImpl: (props: QueryProps) => QueryResult<T>;
}

const LOW_FIDELITY_QUERY_EXTRAS = {
  fidelity: 'low',
} as const;

const HIGH_FIDELITY_QUERY_EXTRAS = {
  fidelity: 'auto',
} as const;

export function useProgressiveQuery<T extends {isFetched: boolean}>({
  enabled,
  useQueryImpl,
  query,
}: ProgressiveQueryOptions<T>): QueryResult<T> & {
  isFetchingHighFidelityData?: boolean;
} {
  const organization = useOrganization();
  const canUseProgressiveLoading = organization.features.includes(
    'visibility-explore-progressive-loading'
  );

  const singleQueryResult = useQueryImpl({enabled, query});

  const lowFidelityResult = useQueryImpl({
    enabled,
    query,
    queryExtras: LOW_FIDELITY_QUERY_EXTRAS,
  });

  const highFidelityResult = useQueryImpl({
    enabled,
    query,
    queryExtras: HIGH_FIDELITY_QUERY_EXTRAS,
  });

  if (!canUseProgressiveLoading) {
    return singleQueryResult;
  }

  if (highFidelityResult.result.isFetched) {
    return {
      ...highFidelityResult,
      isFetchingHighFidelityData: false,
    };
  }

  return {
    ...lowFidelityResult,
    isFetchingHighFidelityData: true,
  };
}
