import {UserFixture} from 'sentry-fixture/user';

import type {AuditLog} from 'sentry/types/organization';

export function UsageLogFixture(params: Partial<AuditLog> = {}): AuditLog {
  return {
    note: 'cancelled plan',
    targetObject: 2,
    targetUser: null,
    data: {},
    dateCreated: '2022-06-06T03:04:23.157Z',
    ipAddress: '127.0.0.1',
    id: '465',
    actor: UserFixture({isSuperuser: true}),
    event: 'plan.cancelled',
    ...params,
  };
}
