import {DateTime} from 'sentry/components/dateTime';

import ResultGrid from 'admin/components/resultGrid';

type Props = Partial<React.ComponentProps<typeof ResultGrid>> & {
  orgSlug: string;
  targetId: string;
};

export function CustomerAuditLog({orgSlug, targetId, ...props}: Props) {
  return (
    <ResultGrid
      path=""
      endpoint="/audit-logs/"
      method="GET"
      defaultParams={{target_id: targetId, org_slug: orgSlug, per_page: 100}}
      useQueryString={false}
      hasPagination={false}
      rowsFromData={(data: any) => data.rows}
      columns={[
        <th key="timestamp" style={{width: 180}}>
          Time
        </th>,
        <th key="event">Action</th>,
        <th key="actor" style={{width: 200}}>
          Staff
        </th>,
        <th key="ticket" style={{width: 200}}>
          Ticket
        </th>,
        <th key="notes">Notes</th>,
      ]}
      columnsForRow={(row: any) => [
        <td key="timestamp">
          <DateTime date={row.timestamp} />
        </td>,
        <td key="event">{row.eventType}</td>,
        <td key="actor">
          {row.actor?.email ? (
            <a href={`mailto:${row.actor.email}`}>{row.actor.name ?? row.actor.email}</a>
          ) : (
            '—'
          )}
        </td>,
        <td key="ticket">{row.ticketId ? <a href={row.ticketId}>Ticket</a> : '—'}</td>,
        <td key="notes">{row.data?.notes ?? '—'}</td>,
      ]}
      {...props}
    />
  );
}
