import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import type {TableColumnConfig} from '@sentry/scraps/table';

import {DateTime} from 'sentry/components/dateTime';
import type {ReplayBulkDeleteAuditLog} from 'sentry/components/replays/bulkDelete/types';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {ERROR_MAP} from 'sentry/utils/requestError/requestError';

const AUDIT_LOG_COLUMNS: TableColumnConfig[] = [
  {key: 'id', width: 'max-content'},
  {key: 'dateCreated', width: 'max-content'},
  {key: 'query', width: '1fr'},
  {key: 'countDeleted', width: 'max-content'},
  {key: 'status', width: 'max-content'},
];

export function ReplayBulkDeleteAuditLogTable({
  error,
  isPending,
  rows,
}: {
  error: Error | null;
  isPending: boolean;
  rows: ReplayBulkDeleteAuditLog[] | undefined;
}) {
  return (
    <SimpleTable
      columns={AUDIT_LOG_COLUMNS}
      header={
        <SimpleTable.HeaderRow>
          <SimpleTable.HeaderCell>{t('ID')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Date Created')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Query')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Count Deleted')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Status')}</SimpleTable.HeaderCell>
        </SimpleTable.HeaderRow>
      }
    >
      {isPending ? (
        <SimpleTable.Loading />
      ) : error ? (
        <SimpleTable.Empty>
          <Alert variant="danger">
            {t('Sorry, the list could not be loaded. ')}
            {getErrorMessage(error)}
          </Alert>
        </SimpleTable.Empty>
      ) : rows?.length ? (
        rows.map(row => (
          <SimpleTable.Row key={row.id}>
            <SimpleTable.RowCell>{row.id}</SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <DateTime date={row.dateCreated} />
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <Query>
                <dt>{t('Query')}</dt>
                <dd>
                  <code>{row.query}</code>
                </dd>
                <dt>{t('Date Range')}</dt>
                <dd>
                  <code>{row.rangeStart}</code>
                  <br />
                  <code>{row.rangeEnd}</code>
                </dd>
                <dt>{t('Environments')}</dt>
                <dd>
                  <code>{row.environments.join(', ')}</code>
                </dd>
              </Query>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>{row.countDeleted}</SimpleTable.RowCell>
            <SimpleTable.RowCell>{row.status}</SimpleTable.RowCell>
          </SimpleTable.Row>
        ))
      ) : (
        <SimpleTable.Empty>{t('No deletes found')}</SimpleTable.Empty>
      )}
    </SimpleTable>
  );
}

function getErrorMessage(fetchError: Error | string) {
  if (typeof fetchError === 'string') {
    return fetchError;
  }
  if (fetchError instanceof RequestError) {
    if (typeof fetchError?.responseJSON?.detail === 'string') {
      return fetchError.responseJSON.detail;
    }
    if (fetchError?.responseJSON?.detail?.message) {
      return fetchError.responseJSON.detail.message;
    }
    if (fetchError.name === ERROR_MAP[500]) {
      return t('There was an internal systems error.');
    }
  }
  return t(
    'This could be due to invalid search parameters or an internal systems error.'
  );
}

const Query = styled('dl')`
  max-width: 100%;
  overflow: scroll;
  padding-bottom: ${p => p.theme.space.md};
`;
