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
}

export default function useReplayBulkDeleteAuditLog({
  projectSlug,
  enabled,
  query,
}: Props) {
  const organization = useOrganization();
  const {data, error, getResponseHeader, isPending} = useApiQuery<{
    data: ReplayBulkDeleteAuditLog[];
  }>([`/projects/${organization.slug}/${projectSlug}/replays/jobs/delete/`, {query}], {
    enabled,
    retry: false,
    staleTime: 0,
  });

  return {data, error, getResponseHeader, isPending};
}
