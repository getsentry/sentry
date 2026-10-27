import {DateTime} from 'sentry/components/dateTime';
import {ResultGrid} from 'sentry/components/resultGrid';
import {SimpleTable} from 'sentry/components/tables/simpleTable';

type Props = {
  orgSlug: string;
  targetId: string;
};

export function CustomerAuditLog({orgSlug, targetId}: Props) {
  return (
    <ResultGrid
      path=""
      endpoint="/audit-logs/"
      defaultParams={{target_id: targetId, org_slug: orgSlug, per_page: 100}}
      useQueryString={false}
      hasPagination={false}
      rowsFromData={(data: any) => data.rows}
      columns={[
        {key: 'timestamp', label: 'Time', width: 180},
        {key: 'event', label: 'Action'},
        {key: 'actor', label: 'Staff', width: 200},
        {key: 'ticket', label: 'Ticket', width: 200},
        {key: 'notes', label: 'Notes'},
      ]}
      columnsForRow={(row: any) => [
        <SimpleTable.RowCell key="timestamp">
          <DateTime date={row.timestamp} />
        </SimpleTable.RowCell>,
        <SimpleTable.RowCell key="event">{row.eventType}</SimpleTable.RowCell>,
        <SimpleTable.RowCell key="actor">
          {row.actor?.email ? (
            <a href={`mailto:${row.actor.email}`}>{row.actor.name ?? row.actor.email}</a>
          ) : (
            '—'
          )}
        </SimpleTable.RowCell>,
        <SimpleTable.RowCell key="ticket">
          {row.ticketId ? <a href={row.ticketId}>Ticket</a> : '—'}
        </SimpleTable.RowCell>,
        <SimpleTable.RowCell key="notes">{row.data?.notes ?? '—'}</SimpleTable.RowCell>,
      ]}
    />
  );
}
