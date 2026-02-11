import {UserFixture} from 'sentry-fixture/user';

import type {AuditLog} from 'sentry/types/organization';

/**
 * Repository settings audit log note variants (for frontend preview).
 * These match the backend template: "updated repository settings for {repository_names}{code_review_change}"
 */
const REPO_SETTINGS_AUDIT_NOTES = [
  'updated repository settings for getsentry/sentry (enabled code review)',
  'updated repository settings for my-org/my-app (disabled code review)',
  'updated repository settings for getsentry/sentry, getsentry/relay, getsentry/getsentry (enabled code review)',
  'updated repository settings for org/repo (added code review on_ready_for_review)',
  'updated repository settings for org/repo (removed code review on_ready_for_review)',
  'updated repository settings for org/repo (added code review on_ready_for_review; removed code review on_new_commit)',
  'updated repository settings for org/repo (triggers set to on_new_commit, on_ready_for_review)',
  'updated repository settings for repo1, repo2 (added code review on_new_commit; removed code review on_ready_for_review)',
];

export function AuditLogsFixture(params: AuditLog[] = []): AuditLog[] {
  const repoSettingsEntries: AuditLog[] = REPO_SETTINGS_AUDIT_NOTES.map((note, i) => ({
    note,
    targetObject: 1,
    targetUser: null,
    data: {},
    dateCreated: new Date(Date.now() - (i + 1) * 3600000).toISOString(),
    ipAddress: '127.0.0.1',
    id: String(500 + i),
    actor: UserFixture({isSuperuser: false}),
    event: 'repo-settings.edit',
  }));

  return [
    ...repoSettingsEntries,
    {
      note: 'edited project ludic-science',
      targetObject: 2,
      targetUser: null,
      data: {
        status: 0,
        slug: 'ludic-science',
        public: false,
        name: 'Ludic Science',
        id: 2,
      },
      dateCreated: '2018-02-21T03:04:23.157Z',
      ipAddress: '127.0.0.1',
      id: '465',
      actor: UserFixture({isSuperuser: true}),
      event: 'project.edit',
    },
    {
      note: 'edited the organization setting(s): accountRateLimit from 1000 to 0',
      targetObject: 2,
      targetUser: null,
      data: {accountRateLimit: 'from 1000 to 0'},
      dateCreated: '2018-02-16T23:45:59.813Z',
      ipAddress: '127.0.0.1',
      id: '408',
      actor: UserFixture({isSuperuser: false}),
      event: 'org.edit',
    },
    ...params,
  ];
}
