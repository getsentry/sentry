import {Fragment} from 'react';

import Pagination from 'sentry/components/pagination';
import ReplayBulkDeleteAuditLogTable from 'sentry/components/replays/bulkDelete/replayBulkDeleteAuditLogTable';
import type {ReplayBulkDeleteAuditLog} from 'sentry/components/replays/bulkDelete/types';
import useReplayBulkDeleteAuditLog from 'sentry/components/replays/bulkDelete/useFetchBulkDeleteLogs';

interface Props {
  projectSlug: string;
}

export default function ReplayBulkDeleteAuditLog({projectSlug}: Props) {
  const {data, getResponseHeader, error, isPending} = useReplayBulkDeleteAuditLog({
    projectSlug,
    query: {referrer: 'replay-settings'},
  });

  return (
    <Fragment>
      <ReplayBulkDeleteAuditLogTable
        rows={data?.data}
        error={error}
        isPending={isPending}
      />
      <Pagination pageLinks={getResponseHeader?.('Link') ?? null} />
    </Fragment>
  );
}
