import type {ReplayBulkDeleteAuditLog} from 'sentry/components/replays/bulkDelete/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  projectSlug: string;
  query: {
    referrer: string;
    offset?: number;
    per_page?: number;
  };
  enabled?: boolean;
  refetchIntervalMs?: number;
}

export default function useReplayBulkDeleteAuditLog({
  enabled,
  projectSlug,
  query,
  refetchIntervalMs,
}: Props) {
  const organization = useOrganization();
  const {data, error, getResponseHeader, isPending, refetch} = useApiQuery<{
    data: ReplayBulkDeleteAuditLog[];
  }>([`/projects/${organization.slug}/${projectSlug}/replays/jobs/delete/`, {query}], {
    enabled,
    refetchInterval: refetchIntervalMs ?? 1_000,
    retry: false,
    staleTime: 0,
  });

  return {data, error, getResponseHeader, isPending, refetch};
}
