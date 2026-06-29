import {UserFixture} from 'sentry-fixture/user';

type AdminAuditLogEntry = {
  actor: {email: string; name: string | null} | null;
  data: Record<string, string>;
  eventCode: number;
  eventType: string;
  id: string;
  ipAddress: string;
  ticketId: string | null;
  timestamp: string;
};

export function AdminAuditLogFixture(
  params: Partial<AdminAuditLogEntry> = {}
): AdminAuditLogEntry {
  const actor = UserFixture({isSuperuser: true});
  return {
    id: '1',
    actor: {email: actor.email, name: actor.name},
    eventCode: 1,
    eventType: 'Plan Cancelled',
    ipAddress: '127.0.0.1',
    timestamp: '2024-01-15T12:00:00.000Z',
    ticketId: null,
    data: {},
    ...params,
  };
}
