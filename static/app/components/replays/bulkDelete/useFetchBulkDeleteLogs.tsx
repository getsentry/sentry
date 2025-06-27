import type {ReplayBulkDeleteAuditLog} from 'sentry/components/replays/bulkDelete/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  projectSlug: string;
  query?: Record<string, string>;
}

export default function useReplayBulkDeleteAuditLog({projectSlug, query}: Props) {
  const organization = useOrganization();
  const {data, error, getResponseHeader, isPending} = useApiQuery<{
    data: ReplayBulkDeleteAuditLog[];
  }>([`/projects/${organization.slug}/${projectSlug}/replays/jobs/delete/`, {query}], {
    staleTime: 0,
    retry: false,
  });

  return {data, error, getResponseHeader, isPending};
}
