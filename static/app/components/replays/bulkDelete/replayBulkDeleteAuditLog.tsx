import {Fragment} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Pagination} from '@sentry/scraps/pagination';

import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {getPaginationProps} from 'sentry/utils/pagination';
import {useOrganization} from 'sentry/utils/useOrganization';

import {replayBulkDeleteAuditLogApiOptions} from './replayBulkDeleteAuditLogApiOptions';
import {ReplayBulkDeleteAuditLogTable} from './replayBulkDeleteAuditLogTable';

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
      <Pagination {...getPaginationProps(pageLinks)} />
    </Fragment>
  );
}
