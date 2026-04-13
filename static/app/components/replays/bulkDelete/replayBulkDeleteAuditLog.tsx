import {Fragment} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Pagination} from 'sentry/components/pagination';
import {replayBulkDeleteAuditLogApiOptions} from 'sentry/components/replays/bulkDelete/replayBulkDeleteAuditLogApiOptions';
import {ReplayBulkDeleteAuditLogTable} from 'sentry/components/replays/bulkDelete/replayBulkDeleteAuditLogTable';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

interface Props {
  projectSlug: string;
}

export function ReplayBulkDeleteAuditLog({projectSlug}: Props) {
  const organization = useOrganization();
  const {data, error, isPending} = useQuery({
    ...replayBulkDeleteAuditLogApiOptions(organization, {
      projectSlug,
      query: {referrer: 'replay-settings'},
    }),
    select: selectJsonWithHeaders,
  });

  const rows = data?.json.data;
  const pageLinks = data?.headers?.Link ?? null;

  return (
    <Fragment>
      <ReplayBulkDeleteAuditLogTable rows={rows} error={error} isPending={isPending} />
      <Pagination pageLinks={pageLinks} />
    </Fragment>
  );
}
