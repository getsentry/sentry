import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {DateTime} from 'sentry/components/dateTime';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {ReplayBulkDeleteAuditLog} from 'sentry/components/replays/bulkDelete/types';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import type RequestError from 'sentry/utils/requestError/requestError';
import {ERROR_MAP} from 'sentry/utils/requestError/requestError';

export default function ReplayBulkDeleteAuditLogTable({
  error,
  isPending,
  rows,
}: {
  error: RequestError | null;
  isPending: boolean;
  rows: ReplayBulkDeleteAuditLog[] | undefined;
}) {
  return (
    <SimpleTableWithColumns>
      <SimpleTable.Header>
        <SimpleTable.HeaderCell>{t('id')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell>{t('Date Created')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell>{t('Query')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell>{t('Count Deleted')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell>{t('Status')}</SimpleTable.HeaderCell>
      </SimpleTable.Header>
      {isPending ? (
        <SimpleTable.Empty>
          <LoadingIndicator />
        </SimpleTable.Empty>
      ) : error ? (
        <SimpleTable.Empty>
          <Alert type="error" showIcon>
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
              <dl>
                <dt>Query</dt>
                <dd>{row.query}</dd>
                <dt>Range</dt>
                <dd>
                  <DateTime date={row.rangeStart} /> - <DateTime date={row.rangeEnd} />
                </dd>
                <dt>Environments</dt>
                <dd>{row.environments.join(', ')}</dd>
              </dl>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>{row.countDeleted}</SimpleTable.RowCell>
            <SimpleTable.RowCell>{row.status}</SimpleTable.RowCell>
          </SimpleTable.Row>
        ))
      ) : (
        <SimpleTable.Empty>{t('No deletes found')}</SimpleTable.Empty>
      )}
    </SimpleTableWithColumns>
  );
}

const SimpleTableWithColumns = styled(SimpleTable)`
  grid-template-columns: repeat(5, 1fr);
`;

function getErrorMessage(fetchError: RequestError) {
  if (typeof fetchError === 'string') {
    return fetchError;
  }
  if (typeof fetchError?.responseJSON?.detail === 'string') {
    return fetchError.responseJSON.detail;
  }
  if (fetchError?.responseJSON?.detail?.message) {
    return fetchError.responseJSON.detail.message;
  }
  if (fetchError.name === ERROR_MAP[500]) {
    return t('There was an internal systems error.');
  }
  return t(
    'This could be due to invalid search parameters or an internal systems error.'
  );
}
