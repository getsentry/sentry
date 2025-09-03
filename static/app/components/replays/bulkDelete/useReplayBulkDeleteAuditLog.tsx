import type {ReplayBulkDeleteAuditLog} from 'sentry/components/replays/bulkDelete/types';
import {useApiQuery, type ApiQueryKey} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

type Query = {
  referrer: string;
  offset?: number;
  per_page?: number;
};

interface Props {
  projectSlug: string;
  query: Query;
  enabled?: boolean;
  refetchIntervalMs?: number;
}

export function useReplayBulkDeleteAuditLogQueryKey({
  projectSlug,
  query,
}: {
  projectSlug: string;
  query: Query;
}): ApiQueryKey {
  const organization = useOrganization();
  return [`/projects/${organization.slug}/${projectSlug}/replays/jobs/delete/`, {query}];
}

export default function useReplayBulkDeleteAuditLog({
  enabled,
  projectSlug,
  query,
  refetchIntervalMs,
}: Props) {
  const queryKey = useReplayBulkDeleteAuditLogQueryKey({projectSlug, query});
  const {data, error, getResponseHeader, isPending, refetch} = useApiQuery<{
    data: ReplayBulkDeleteAuditLog[];
  }>(queryKey, {
    enabled,
    refetchInterval: refetchIntervalMs ?? 1_000,
    retry: false,
    staleTime: 0,
  });

  return {data, error, getResponseHeader, isPending, refetch};
}
