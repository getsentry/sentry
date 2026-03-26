# Layout.Page Audit — Summary & Remediation Todo

## Totals

| Area                                        | Compliant | Missing | Total   |
| ------------------------------------------- | --------- | ------- | ------- |
| A — Root & Standalone                       | 2         | 18      | 20      |
| B — Settings                                | 95        | 0       | 95      |
| C — Stats, Projects, Dashboards             | 8         | 5       | 13      |
| D — Alerts & Monitors                       | 6         | 29      | 35      |
| E — Replays, Releases, Discover             | 7         | 0       | 7       |
| F — Insights / Module Routes                | 2         | 37      | 39      |
| G — Performance, Traces, Profiling, Explore | 10        | 8       | 18      |
| H — Feedback & Issues                       | 12        | 12      | 24      |
| I — Admin                                   | 0         | 11      | 11      |
| **Total**                                   | **142**   | **120** | **262** |

---

## Todo List

Routes marked with `[ ]` are missing `Layout.Page` and have visible UI content.
Pure redirect shims and Outlet-only pass-through wrappers (no rendered UI) are excluded.

### A — Root & Standalone Routes

- [ ] `/auth/login/` — `sentry/views/auth/login`
- [ ] `/accept/:orgId/:memberId/:token/` — `sentry/views/acceptOrganizationInvite`
- [ ] `/accept/:memberId/:token/` — `sentry/views/acceptOrganizationInvite`
- [ ] `/accept-transfer/` — `sentry/views/acceptProjectTransfer`
- [ ] `/extensions/external-install/:integrationSlug/:installationId` — `sentry/views/integrationOrganizationLink`
- [ ] `/extensions/:integrationSlug/link/` — `sentry/views/integrationOrganizationLink`
- [ ] `/sentry-apps/:sentryAppSlug/external-install/` — `sentry/views/sentryAppExternalInstallation`
- [ ] `/share/issue/:shareId/` — `sentry/views/sharedGroupDetails`
- [ ] `/organizations/:orgId/share/issue/:shareId/` — `sentry/views/sharedGroupDetails`
- [ ] `/unsubscribe/project/:id/` — `sentry/views/unsubscribe/project`
- [ ] `/unsubscribe/:orgId/project/:id/` — `sentry/views/unsubscribe/project`
- [ ] `/unsubscribe/issue/:id/` — `sentry/views/unsubscribe/issue`
- [ ] `/unsubscribe/:orgId/issue/:id/` — `sentry/views/unsubscribe/issue`
- [ ] `/organizations/new/` — `sentry/views/organizationCreate`
- [ ] `/organizations/:orgId/data-export/:dataExportId` — `sentry/views/dataExport/dataDownload`
- [ ] `/organizations/:orgId/disabled-member/` — `sentry/views/disabledMember`
- [ ] `/restore/` — `sentry/views/organizationRestore`
- [ ] `/organizations/:orgId/restore/` — `sentry/views/organizationRestore`
- [ ] `/join-request/` — `sentry/views/organizationJoinRequest`
- [ ] `/join-request/:orgId/` — `sentry/views/organizationJoinRequest`
- [ ] `/relocation/:step/` — `sentry/views/relocation` _(partial: only uses Layout.Page in feature-disabled fallback)_
- [ ] `/onboarding/:orgId/:step/` — `sentry/views/onboarding/onboarding`

### B — Settings Routes

_All compliant via `SettingsWrapper` inheritance. Nothing to do._

### C — Stats, Projects, Dashboards

- [ ] `/organizations/:orgId/stats/` — `sentry/views/organizationStats/index`
- [ ] `/organizations/:orgId/stats/` (teamInsights wrapper) — `sentry/views/organizationStats/teamInsights/index`
- [ ] `/organizations/:orgId/stats/issues/` — `sentry/views/organizationStats/teamInsights/issues`
- [ ] `/organizations/:orgId/stats/health/` — `sentry/views/organizationStats/teamInsights/health`
- [ ] `/organizations/:orgId/projects/new/` — `sentry/views/projectInstall/newProject`

### D — Alerts & Monitors

- [ ] `/organizations/:orgId/alerts/` — `sentry/views/alerts/list/incidents`
- [ ] `/organizations/:orgId/alerts/rules/` — `sentry/views/alerts/list/rules/alertRulesList`
- [ ] `/organizations/:orgId/alerts/:projectId/new/` — `sentry/views/alerts/create`
- [ ] `/organizations/:orgId/alerts/crons-rules/:projectId/:monitorSlug/` — `sentry/views/alerts/edit`
- [ ] `/organizations/:orgId/monitors/` — `sentry/views/detectors/list/allMonitors`
- [ ] `/organizations/:orgId/monitors/monitors/new` — `sentry/views/detectors/new`
- [ ] `/organizations/:orgId/monitors/monitors/:detectorId/` — `sentry/views/detectors/detail`
- [ ] `/organizations/:orgId/monitors/monitors/:detectorId/edit/` — `sentry/views/detectors/edit`
- [ ] `/organizations/:orgId/monitors/my-monitors/` — `sentry/views/detectors/list/myMonitors`
- [ ] `/organizations/:orgId/monitors/errors/` — `sentry/views/detectors/list/error`
- [ ] `/organizations/:orgId/monitors/metrics/` — `sentry/views/detectors/list/metric`
- [ ] `/organizations/:orgId/monitors/crons/` — `sentry/views/detectors/list/cron`
- [ ] `/organizations/:orgId/monitors/uptime/` — `sentry/views/detectors/list/uptime`
- [ ] `/organizations/:orgId/monitors/mobile-builds/` — `sentry/views/detectors/list/mobileBuild`
- [ ] `/organizations/:orgId/monitors/alerts/` — `sentry/views/automations/list`
- [ ] `/organizations/:orgId/monitors/alerts/:automationId/` — `sentry/views/automations/detail`

### E — Replays, Releases, Discover

_All leaf pages compliant. Thin containers (replays/index, releases/index, discover/index) are
Outlet-only wrappers with no rendered UI. `discover/eventDetails` is a redirect shim.
`discover/homepage` delegates to `Results` which has `Layout.Page`. Nothing to do._

### F — Insights / Module Routes

- [ ] `/organizations/:orgId/insights/` — `sentry/views/insights/index`
- [ ] `/organizations/:orgId/insights/frontend/` — `sentry/views/insights/pages/frontend/frontendOverviewPage`
- [ ] `/organizations/:orgId/insights/frontend/http/` — `sentry/views/insights/http/views/httpLandingPage`
- [ ] `/organizations/:orgId/insights/frontend/http/domains/` — `sentry/views/insights/http/views/httpDomainSummaryPage`
- [ ] `/organizations/:orgId/insights/frontend/pageloads/` — `sentry/views/insights/browser/webVitals/views/webVitalsLandingPage`
- [ ] `/organizations/:orgId/insights/frontend/pageloads/overview/` — `sentry/views/insights/browser/webVitals/views/pageOverview`
- [ ] `/organizations/:orgId/insights/frontend/assets/` — `sentry/views/insights/browser/resources/views/resourcesLandingPage`
- [ ] `/organizations/:orgId/insights/frontend/assets/spans/span/:groupId/` — `sentry/views/insights/browser/resources/views/resourceSummaryPage`
- [ ] `/organizations/:orgId/insights/frontend/sessions/` — `sentry/views/insights/sessions/views/overview`
- [ ] `/organizations/:orgId/insights/backend/` — `sentry/views/insights/pages/backend/backendOverviewPage`
- [ ] `/organizations/:orgId/insights/backend/http/` — `sentry/views/insights/http/views/httpLandingPage`
- [ ] `/organizations/:orgId/insights/backend/http/domains/` — `sentry/views/insights/http/views/httpDomainSummaryPage`
- [ ] `/organizations/:orgId/insights/backend/database/` — `sentry/views/insights/database/views/databaseLandingPage`
- [ ] `/organizations/:orgId/insights/backend/database/spans/span/:groupId/` — `sentry/views/insights/database/views/databaseSpanSummaryPage`
- [ ] `/organizations/:orgId/insights/backend/caches/` — `sentry/views/insights/cache/views/cacheLandingPage`
- [ ] `/organizations/:orgId/insights/backend/queues/` — `sentry/views/insights/queues/views/queuesLandingPage`
- [ ] `/organizations/:orgId/insights/backend/queues/destination/` — `sentry/views/insights/queues/views/destinationSummaryPage`
- [ ] `/organizations/:orgId/insights/backend/sessions/` — `sentry/views/insights/sessions/views/overview`
- [ ] `/organizations/:orgId/insights/mobile/` — `sentry/views/insights/pages/mobile/mobileOverviewPage`
- [ ] `/organizations/:orgId/insights/mobile/http/` — `sentry/views/insights/http/views/httpLandingPage`
- [ ] `/organizations/:orgId/insights/mobile/http/domains/` — `sentry/views/insights/http/views/httpDomainSummaryPage`
- [ ] `/organizations/:orgId/insights/mobile/sessions/` — `sentry/views/insights/sessions/views/overview`
- [ ] `/organizations/:orgId/insights/mcp/` — `sentry/views/insights/pages/mcp/overview`
- [ ] `/organizations/:orgId/insights/mcp/tools/` — `sentry/views/insights/mcp-tools/views/mcpToolsLandingPage`
- [ ] `/organizations/:orgId/insights/mcp/resources/` — `sentry/views/insights/mcp-resources/views/mcpResourcesLandingPage`
- [ ] `/organizations/:orgId/insights/mcp/prompts/` — `sentry/views/insights/mcp-prompts/views/mcpPromptsLandingPage`
- [ ] `/organizations/:orgId/insights/ai-agents/` — `sentry/views/insights/pages/agents/overview`
- [ ] `/organizations/:orgId/insights/ai-agents/models/` — `sentry/views/insights/agentModels/views/modelsLandingPage`
- [ ] `/organizations/:orgId/insights/ai-agents/tools/` — `sentry/views/insights/agentTools/views/toolsLandingPage`
- [ ] `/organizations/:orgId/insights/uptime/` — `sentry/views/insights/uptime/views/overview`
- [ ] `/organizations/:orgId/insights/crons/` — `sentry/views/insights/crons/views/overview`

_Note: `httpLandingPage`, `httpDomainSummaryPage`, and `sessions/views/overview` appear across
multiple domain paths (frontend/backend/mobile) — fixing those shared components will resolve
multiple entries above at once._

### G — Performance, Traces, Profiling, Explore

- [ ] `/organizations/:orgId/performance/summary/` — `sentry/views/performance/transactionSummary/transactionOverview/index`
- [ ] `/organizations/:orgId/performance/summary/tags/` — `sentry/views/performance/transactionSummary/transactionTags/index`
- [ ] `/organizations/:orgId/performance/summary/events/` — `sentry/views/performance/transactionSummary/transactionEvents/index`
- [ ] `/organizations/:orgId/performance/summary/profiles/` — `sentry/views/performance/transactionSummary/transactionProfiles/index`
- [ ] `/organizations/:orgId/traces/` — `sentry/views/traces/content`
- [ ] `/organizations/:orgId/profiling/summary/:projectId/` — `sentry/views/profiling/profileSummary/index`
- [ ] `/organizations/:orgId/profiling/profile/:projectId/differential-flamegraph/` — `sentry/views/profiling/differentialFlamegraph`
- [ ] `/organizations/:orgId/explore/conversations/` — `sentry/views/insights/pages/conversations/overview`

### H — Feedback & Issues

- [ ] `/organizations/:orgId/issues/:groupId/` — `sentry/views/issueDetails/groupEventDetails/groupEventDetails`
- [ ] `/organizations/:orgId/issues/:groupId/activity/` — `sentry/views/issueDetails/groupEventDetails/groupEventDetails`
- [ ] `/organizations/:orgId/issues/:groupId/events/` — `sentry/views/issueDetails/groupEvents`
- [ ] `/organizations/:orgId/issues/:groupId/open-periods/` — `sentry/views/issueDetails/groupOpenPeriods`
- [ ] `/organizations/:orgId/issues/:groupId/uptime-checks/` — `sentry/views/issueDetails/groupUptimeChecks`
- [ ] `/organizations/:orgId/issues/:groupId/check-ins/` — `sentry/views/issueDetails/groupCheckIns`
- [ ] `/organizations/:orgId/issues/:groupId/distributions/` — `sentry/views/issueDetails/groupEventDetails/groupEventDetails`
- [ ] `/organizations/:orgId/issues/:groupId/distributions/:tagKey/` — `sentry/views/issueDetails/groupEventDetails/groupEventDetails`
- [ ] `/organizations/:orgId/issues/:groupId/feedback/` — `sentry/views/issueDetails/groupUserFeedback`
- [ ] `/organizations/:orgId/issues/:groupId/attachments/` — `sentry/views/issueDetails/groupEventAttachments/index`
- [ ] `/organizations/:orgId/issues/:groupId/similar/` — `sentry/views/issueDetails/groupEventDetails/groupEventDetails`
- [ ] `/organizations/:orgId/issues/:groupId/merged/` — `sentry/views/issueDetails/groupEventDetails/groupEventDetails`

_Note: many of these share `groupEventDetails` as the component — fixing that one file resolves
multiple tabs._

### I — Admin

- [ ] `/manage/` — `sentry/views/admin/adminEnvironment`
- [ ] `/manage/status/environment/` — `sentry/views/admin/adminEnvironment`
- [ ] `/manage/relays/` — `sentry/views/admin/adminRelays`
- [ ] `/manage/organizations/` — `sentry/views/admin/adminOrganizations`
- [ ] `/manage/projects/` — `sentry/views/admin/adminProjects`
- [ ] `/manage/settings/` — `sentry/views/admin/adminSettings`
- [ ] `/manage/users/` — `sentry/views/admin/adminUsers`
- [ ] `/manage/users/:id` — `sentry/views/admin/adminUserEdit`
- [ ] `/manage/status/mail/` — `sentry/views/admin/adminMail`
- [ ] `/manage/status/packages/` — `sentry/views/admin/adminPackages`
- [ ] `/manage/status/warnings/` — `sentry/views/admin/adminWarnings`

---

## Notes

### Shared components — fix once, resolve many

- `sentry/views/insights/http/views/httpLandingPage` — used by frontend, backend, and mobile
  domain paths (3 entries)
- `sentry/views/insights/http/views/httpDomainSummaryPage` — same (3 entries)
- `sentry/views/insights/sessions/views/overview` — used by frontend, backend, and mobile (3
  entries)
- `sentry/views/issueDetails/groupEventDetails/groupEventDetails` — covers details, activity,
  distributions, similar, and merged tabs (6 entries)

### Partial compliance

- `sentry/views/relocation` — `index.tsx` uses `Layout.Page` only in a feature-disabled
  fallback rendering path; the primary rendered component `relocation.tsx` does not use it.
- `sentry/views/performance/index` and `sentry/views/profiling/index` — both use `Layout.Page`
  only in their `renderDisabled` fallback path, not in the main Outlet-rendering path.

### Files that import Layout but do not use Layout.Page

- `sentry/views/insights/pages/conversations/overview` — imports `* as Layout` from thirds but
  never uses `Layout.Page`.
- Several domain overview pages (frontendOverviewPage, backendOverviewPage, mobileOverviewPage)
  import `* as Layout` but use only `Layout.Header`, `Layout.Body`, etc. without `Layout.Page`.

### Admin uses SettingsLayout instead of Layout.Page

- `sentry/views/admin/adminLayout` wraps children in `SettingsLayout` (the settings panel UI)
  rather than `Layout.Page`. The entire `/manage/` subtree is non-compliant as a result.

### Wrappers confirmed as Outlet-only (no Layout.Page, no UI)

These are excluded from the todo list as they have no rendered UI of their own:
`AppBodyContentRoute`, `OrganizationStatsWrapper`, `alerts/index` (AlertsContainer),
`detectorViewContainer`, `replays/index`, `releases/index`, `discover/index`,
`dashboards/index`, `projects/index`, `traces/index`, `explore/logs/index`,
`explore/metrics/index`, `conversations/layout`, `transactionSummary/layout`,
`continuousProfileProvider`, `transactionProfileProvider`.
