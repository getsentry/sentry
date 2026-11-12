import {DateTime} from 'sentry/components/dateTime';
import {ResultGrid} from 'sentry/components/resultGrid';
import {SimpleTable} from 'sentry/components/tables/simpleTable';

const SIMULATE_LLM_USAGE_EVENT = 'Org: Simulate LLM usage';

function auditNote(row: any): React.ReactNode {
  const data = row.data ?? {};
  if (row.eventType === SIMULATE_LLM_USAGE_EVENT) {
    const usage = `Simulated $${Number(data.cost_usd).toFixed(2)} of ${data.feature} usage in project ${data.project_id} (call ${data.litellm_call_id})`;
    return data.notes ? `${usage}: ${data.notes}` : usage;
  }
  return data.notes ?? '—';
}

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
        <SimpleTable.RowCell key="notes">{auditNote(row)}</SimpleTable.RowCell>,
      ]}
    />
  );
}
