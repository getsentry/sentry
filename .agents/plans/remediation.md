# Layout.Page Remediation Plan

This file is the authoritative work plan for migrating non-compliant routes to use
`Layout.Page`. It is written as context for sub-agents performing the migration.

---

## What the migration does

Every page route in Sentry should render `Layout.Page` as the outermost content container.
`Layout.Page` is exported from `sentry/components/layouts/thirds` and renders as a `<main>`
element with responsive page-frame styling, padding, and navigation context awareness.

A route is **compliant** when `Layout.Page` appears anywhere in its render tree — either in the
leaf component itself or in a parent layout wrapper that renders `<Outlet />`.

---

## How to perform the migration

### Pattern 1 — Wrapper fix (preferred when a parent renders `<Outlet />`)

If a parent route component renders `<Outlet />` without `Layout.Page`, wrapping the Outlet
in `Layout.Page` makes every child route compliant in one change:

```tsx
// Before
import {Outlet} from 'react-router-dom';

export function SomeLayout() {
  return (
    <SomeProviders>
      <Outlet />
    </SomeProviders>
  );
}

// After
import {Outlet} from 'react-router-dom';
import * as Layout from 'sentry/components/layouts/thirds';

export function SomeLayout() {
  return (
    <Layout.Page>
      <SomeProviders>
        <Outlet />
      </SomeProviders>
    </Layout.Page>
  );
}
```

### Pattern 2 — Leaf fix (when there is no shared wrapper)

Wrap the root JSX element of the component in `Layout.Page`:

```tsx
// Before
import * as Layout from 'sentry/components/layouts/thirds';

export function SomePage() {
  return (
    <Layout.Body>
      <Layout.Main>{/* page content */}</Layout.Main>
    </Layout.Body>
  );
}

// After
import * as Layout from 'sentry/components/layouts/thirds';

export function SomePage() {
  return (
    <Layout.Page>
      <Layout.Body>
        <Layout.Main>{/* page content */}</Layout.Main>
      </Layout.Body>
    </Layout.Page>
  );
}
```

For pages that don't already use `Layout.*`, add the import and wrap the outermost element:

```tsx
// Before
export function SomePage() {
  return <div>{/* page content */}</div>;
}

// After
import * as Layout from 'sentry/components/layouts/thirds';

export function SomePage() {
  return (
    <Layout.Page withPadding>
      <div>{/* page content */}</div>
    </Layout.Page>
  );
}
```

Use `withPadding` when the page has no inner layout structure of its own (simple content pages,
error states, standalone forms). Omit it when `Layout.Body` / `Layout.Main` handle spacing.

### Pattern 3 — Styled extension (already counts as compliant, no change needed)

If the codebase already has `styled(Layout.Page)` and the styled component is rendered, the
route is **already compliant**. Do not add a second `Layout.Page` wrapper on top.

---

## What to avoid

- **Double-wrapping** — if a parent wrapper already provides `Layout.Page` via Outlet
  inheritance, do not add another `Layout.Page` in the leaf component. Check the route tree
  before modifying a leaf.
- **Wrapping non-page components** — only the top-level route component should render
  `Layout.Page`. Inner components (headers, sidebars, panels) should not.
- **Breaking existing `Layout.Body` / `Layout.Main` structure** — `Layout.Page` is the outer
  shell. Everything inside it (including `Layout.Body`, `Layout.Header`, `Layout.Main`) stays
  as-is.

---

## How to verify the fix

After making a change, confirm compliance by checking that at least one of these patterns
exists in the file (or in a parent wrapper that renders `<Outlet />`):

```
grep -n "Layout\.Page" <file>
grep -n "styled(Layout\.Page" <file>
```

Also do a visual check: run the dev server and load the route. The page should render inside
a `<main>` element (inspectable in browser devtools).

---

## Work groups

Ordered by recommended attack order: wrapper fixes first (highest leverage), then leaf fixes.

---

### Group 1 — `/organizations/:orgId/issues/:groupId/` (12 routes)

**Strategy:** Wrapper fix — add `Layout.Page` to `groupDetails`.

**Wrapper to fix:**
`static/app/views/issueDetails/groupDetails.tsx`

This component renders `<Outlet />` for all issue detail tabs. Adding `Layout.Page` around the
Outlet makes all 12 tabs compliant at once. The `groupReplays` tab already has its own
`Layout.Page` — verify it does not double-wrap after the parent is fixed (remove the leaf
`Layout.Page` from `groupReplays` if needed).

**Routes fixed:**

| Path                                                           | Component                                                       |
| -------------------------------------------------------------- | --------------------------------------------------------------- |
| `/organizations/:orgId/issues/:groupId/`                       | `sentry/views/issueDetails/groupEventDetails/groupEventDetails` |
| `/organizations/:orgId/issues/:groupId/activity/`              | `sentry/views/issueDetails/groupEventDetails/groupEventDetails` |
| `/organizations/:orgId/issues/:groupId/events/`                | `sentry/views/issueDetails/groupEvents`                         |
| `/organizations/:orgId/issues/:groupId/open-periods/`          | `sentry/views/issueDetails/groupOpenPeriods`                    |
| `/organizations/:orgId/issues/:groupId/uptime-checks/`         | `sentry/views/issueDetails/groupUptimeChecks`                   |
| `/organizations/:orgId/issues/:groupId/check-ins/`             | `sentry/views/issueDetails/groupCheckIns`                       |
| `/organizations/:orgId/issues/:groupId/distributions/`         | `sentry/views/issueDetails/groupEventDetails/groupEventDetails` |
| `/organizations/:orgId/issues/:groupId/distributions/:tagKey/` | `sentry/views/issueDetails/groupEventDetails/groupEventDetails` |
| `/organizations/:orgId/issues/:groupId/feedback/`              | `sentry/views/issueDetails/groupUserFeedback`                   |
| `/organizations/:orgId/issues/:groupId/attachments/`           | `sentry/views/issueDetails/groupEventAttachments/index`         |
| `/organizations/:orgId/issues/:groupId/similar/`               | `sentry/views/issueDetails/groupEventDetails/groupEventDetails` |
| `/organizations/:orgId/issues/:groupId/merged/`                | `sentry/views/issueDetails/groupEventDetails/groupEventDetails` |

---

### Group 2 — `/organizations/:orgId/monitors/` (12 routes)

**Strategy:** Wrapper fix — add `Layout.Page` to `detectorViewContainer`.

**Wrapper to fix:**
`static/app/views/detectors/detectorViewContainer.tsx`

This is the parent for all monitor/detector routes. Currently renders `PageFiltersContainer`

- `<Outlet />` without `Layout.Page`.

**Routes fixed:**

| Path                                                        | Component                                 |
| ----------------------------------------------------------- | ----------------------------------------- |
| `/organizations/:orgId/monitors/`                           | `sentry/views/detectors/list/allMonitors` |
| `/organizations/:orgId/monitors/monitors/new`               | `sentry/views/detectors/new`              |
| `/organizations/:orgId/monitors/monitors/:detectorId/`      | `sentry/views/detectors/detail`           |
| `/organizations/:orgId/monitors/monitors/:detectorId/edit/` | `sentry/views/detectors/edit`             |
| `/organizations/:orgId/monitors/my-monitors/`               | `sentry/views/detectors/list/myMonitors`  |
| `/organizations/:orgId/monitors/errors/`                    | `sentry/views/detectors/list/error`       |
| `/organizations/:orgId/monitors/metrics/`                   | `sentry/views/detectors/list/metric`      |
| `/organizations/:orgId/monitors/crons/`                     | `sentry/views/detectors/list/cron`        |
| `/organizations/:orgId/monitors/uptime/`                    | `sentry/views/detectors/list/uptime`      |
| `/organizations/:orgId/monitors/mobile-builds/`             | `sentry/views/detectors/list/mobileBuild` |
| `/organizations/:orgId/monitors/alerts/`                    | `sentry/views/automations/list`           |
| `/organizations/:orgId/monitors/alerts/:automationId/`      | `sentry/views/automations/detail`         |

Note: `detectors/new-settings` and `automations/new` and `automations/edit` already use
`Layout.Page` — verify they do not double-wrap after the parent is fixed.

---

### Group 3 — `/manage/` (11 routes)

**Strategy:** Wrapper fix — add `Layout.Page` to `adminLayout`.

**Wrapper to fix:**
`static/app/views/admin/adminLayout.tsx`

Currently wraps children in `SettingsLayout` + `<Outlet />`. Add `Layout.Page` as the
outermost wrapper around `SettingsLayout`.

**Routes fixed:**

| Path                          | Component                               |
| ----------------------------- | --------------------------------------- |
| `/manage/`                    | `sentry/views/admin/adminEnvironment`   |
| `/manage/status/environment/` | `sentry/views/admin/adminEnvironment`   |
| `/manage/relays/`             | `sentry/views/admin/adminRelays`        |
| `/manage/organizations/`      | `sentry/views/admin/adminOrganizations` |
| `/manage/projects/`           | `sentry/views/admin/adminProjects`      |
| `/manage/settings/`           | `sentry/views/admin/adminSettings`      |
| `/manage/users/`              | `sentry/views/admin/adminUsers`         |
| `/manage/users/:id`           | `sentry/views/admin/adminUserEdit`      |
| `/manage/status/mail/`        | `sentry/views/admin/adminMail`          |
| `/manage/status/packages/`    | `sentry/views/admin/adminPackages`      |
| `/manage/status/warnings/`    | `sentry/views/admin/adminWarnings`      |

---

### Group 4 — `/organizations/:orgId/stats/` (4 routes)

**Strategy:** Wrapper fix — add `Layout.Page` to `OrganizationStatsWrapper`.

**Wrapper to fix:**
`static/app/views/organizationStats/organizationStatsWrapper.tsx`

Currently an Outlet-only pass-through. Adding `Layout.Page` covers all stats children.

**Routes fixed:**

| Path                                          | Component                                            |
| --------------------------------------------- | ---------------------------------------------------- |
| `/organizations/:orgId/stats/`                | `sentry/views/organizationStats/index`               |
| `/organizations/:orgId/stats/` (teamInsights) | `sentry/views/organizationStats/teamInsights/index`  |
| `/organizations/:orgId/stats/issues/`         | `sentry/views/organizationStats/teamInsights/issues` |
| `/organizations/:orgId/stats/health/`         | `sentry/views/organizationStats/teamInsights/health` |

---

### Group 5 — `/organizations/:orgId/performance/summary/` (4 routes)

**Strategy:** Wrapper fix — add `Layout.Page` to `transactionSummary/layout`.

**Wrapper to fix:**
`static/app/views/performance/transactionSummary/layout.tsx`

Renders `<Outlet />` for all transaction summary tabs without `Layout.Page`.
`transactionReplays` already uses `Layout.Page` — check for double-wrap after fix.

**Routes fixed:**

| Path                                                  | Component                                                               |
| ----------------------------------------------------- | ----------------------------------------------------------------------- |
| `/organizations/:orgId/performance/summary/`          | `sentry/views/performance/transactionSummary/transactionOverview/index` |
| `/organizations/:orgId/performance/summary/tags/`     | `sentry/views/performance/transactionSummary/transactionTags/index`     |
| `/organizations/:orgId/performance/summary/events/`   | `sentry/views/performance/transactionSummary/transactionEvents/index`   |
| `/organizations/:orgId/performance/summary/profiles/` | `sentry/views/performance/transactionSummary/transactionProfiles/index` |

---

### Group 6 — `/organizations/:orgId/insights/` (31 routes)

**Strategy:** Leaf fixes. No shared wrapper is available.
Fix shared components first — each resolves 3 routes at once:

| Shared component                                         | Paths affected                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------------- |
| `sentry/views/insights/http/views/httpLandingPage`       | `frontend/http/`, `backend/http/`, `mobile/http/`                         |
| `sentry/views/insights/http/views/httpDomainSummaryPage` | `frontend/http/domains/`, `backend/http/domains/`, `mobile/http/domains/` |
| `sentry/views/insights/sessions/views/overview`          | `frontend/sessions/`, `backend/sessions/`, `mobile/sessions/`             |

Then fix the remaining unique leaf components:

| Path                                                                   | Component                                                            |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `/organizations/:orgId/insights/`                                      | `sentry/views/insights/index`                                        |
| `/organizations/:orgId/insights/frontend/`                             | `sentry/views/insights/pages/frontend/frontendOverviewPage`          |
| `/organizations/:orgId/insights/frontend/pageloads/`                   | `sentry/views/insights/browser/webVitals/views/webVitalsLandingPage` |
| `/organizations/:orgId/insights/frontend/pageloads/overview/`          | `sentry/views/insights/browser/webVitals/views/pageOverview`         |
| `/organizations/:orgId/insights/frontend/assets/`                      | `sentry/views/insights/browser/resources/views/resourcesLandingPage` |
| `/organizations/:orgId/insights/frontend/assets/spans/span/:groupId/`  | `sentry/views/insights/browser/resources/views/resourceSummaryPage`  |
| `/organizations/:orgId/insights/backend/`                              | `sentry/views/insights/pages/backend/backendOverviewPage`            |
| `/organizations/:orgId/insights/backend/database/`                     | `sentry/views/insights/database/views/databaseLandingPage`           |
| `/organizations/:orgId/insights/backend/database/spans/span/:groupId/` | `sentry/views/insights/database/views/databaseSpanSummaryPage`       |
| `/organizations/:orgId/insights/backend/caches/`                       | `sentry/views/insights/cache/views/cacheLandingPage`                 |
| `/organizations/:orgId/insights/backend/queues/`                       | `sentry/views/insights/queues/views/queuesLandingPage`               |
| `/organizations/:orgId/insights/backend/queues/destination/`           | `sentry/views/insights/queues/views/destinationSummaryPage`          |
| `/organizations/:orgId/insights/mobile/`                               | `sentry/views/insights/pages/mobile/mobileOverviewPage`              |
| `/organizations/:orgId/insights/mcp/`                                  | `sentry/views/insights/pages/mcp/overview`                           |
| `/organizations/:orgId/insights/mcp/tools/`                            | `sentry/views/insights/mcp-tools/views/mcpToolsLandingPage`          |
| `/organizations/:orgId/insights/mcp/resources/`                        | `sentry/views/insights/mcp-resources/views/mcpResourcesLandingPage`  |
| `/organizations/:orgId/insights/mcp/prompts/`                          | `sentry/views/insights/mcp-prompts/views/mcpPromptsLandingPage`      |
| `/organizations/:orgId/insights/ai-agents/`                            | `sentry/views/insights/pages/agents/overview`                        |
| `/organizations/:orgId/insights/ai-agents/models/`                     | `sentry/views/insights/agentModels/views/modelsLandingPage`          |
| `/organizations/:orgId/insights/ai-agents/tools/`                      | `sentry/views/insights/agentTools/views/toolsLandingPage`            |
| `/organizations/:orgId/insights/uptime/`                               | `sentry/views/insights/uptime/views/overview`                        |
| `/organizations/:orgId/insights/crons/`                                | `sentry/views/insights/crons/views/overview`                         |

---

### Group 7 — `/organizations/:orgId/alerts/` (4 routes)

**Strategy:** Leaf fixes. `AlertsContainer` is Outlet-only with no UI of its own — not worth
adding `Layout.Page` there.

| Path                                                                | Component                                       |
| ------------------------------------------------------------------- | ----------------------------------------------- |
| `/organizations/:orgId/alerts/`                                     | `sentry/views/alerts/list/incidents`            |
| `/organizations/:orgId/alerts/rules/`                               | `sentry/views/alerts/list/rules/alertRulesList` |
| `/organizations/:orgId/alerts/:projectId/new/`                      | `sentry/views/alerts/create`                    |
| `/organizations/:orgId/alerts/crons-rules/:projectId/:monitorSlug/` | `sentry/views/alerts/edit`                      |

---

### Group 8 — Standalone pages (22 routes, 14 unique components)

**Strategy:** Leaf fixes. Each component is independent — fix each in isolation.

| Path                                                                                                     | Component                                                              |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `/auth/login/`                                                                                           | `sentry/views/auth/login`                                              |
| `/accept/:orgId/:memberId/:token/` and `/accept/:memberId/:token/`                                       | `sentry/views/acceptOrganizationInvite`                                |
| `/accept-transfer/`                                                                                      | `sentry/views/acceptProjectTransfer`                                   |
| `/extensions/external-install/:integrationSlug/:installationId` and `/extensions/:integrationSlug/link/` | `sentry/views/integrationOrganizationLink`                             |
| `/sentry-apps/:sentryAppSlug/external-install/`                                                          | `sentry/views/sentryAppExternalInstallation`                           |
| `/share/issue/:shareId/` and `/organizations/:orgId/share/issue/:shareId/`                               | `sentry/views/sharedGroupDetails`                                      |
| `/unsubscribe/project/:id/` and `/unsubscribe/:orgId/project/:id/`                                       | `sentry/views/unsubscribe/project`                                     |
| `/unsubscribe/issue/:id/` and `/unsubscribe/:orgId/issue/:id/`                                           | `sentry/views/unsubscribe/issue`                                       |
| `/organizations/new/`                                                                                    | `sentry/views/organizationCreate`                                      |
| `/organizations/:orgId/data-export/:dataExportId`                                                        | `sentry/views/dataExport/dataDownload`                                 |
| `/organizations/:orgId/disabled-member/`                                                                 | `sentry/views/disabledMember`                                          |
| `/restore/` and `/organizations/:orgId/restore/`                                                         | `sentry/views/organizationRestore`                                     |
| `/join-request/` and `/join-request/:orgId/`                                                             | `sentry/views/organizationJoinRequest`                                 |
| `/relocation/:step/`                                                                                     | `sentry/views/relocation` _(fix `relocation.tsx`, not the index gate)_ |
| `/onboarding/:orgId/:step/`                                                                              | `sentry/views/onboarding/onboarding`                                   |

---

### Group 9 — Remaining isolated pages (4 routes)

**Strategy:** Leaf fixes. Small and isolated — easy cleanup.

| Path                                                                          | Component                                                                                                              |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `/organizations/:orgId/traces/`                                               | `sentry/views/traces/content`                                                                                          |
| `/organizations/:orgId/profiling/summary/:projectId/`                         | `sentry/views/profiling/profileSummary/index`                                                                          |
| `/organizations/:orgId/profiling/profile/:projectId/differential-flamegraph/` | `sentry/views/profiling/differentialFlamegraph`                                                                        |
| `/organizations/:orgId/explore/conversations/`                                | `sentry/views/insights/pages/conversations/overview` _(already imports `* as Layout`, just needs `Layout.Page` added)_ |
| `/organizations/:orgId/projects/new/`                                         | `sentry/views/projectInstall/newProject`                                                                               |

---

## Instructions for sub-agents

When assigned a group:

1. **Read the wrapper or leaf file** before making any changes.
2. **Check for existing `Layout.Page` usage** (grep for `Layout\.Page` and
   `styled\(Layout\.Page`) — if it already exists, the route may already be compliant and the
   audit entry may be stale.
3. **For wrapper fixes**: add `Layout.Page` around the `<Outlet />` (and any providers that
   should sit inside the page shell). Add the import if not present.
4. **For leaf fixes**: add `Layout.Page` as the outermost wrapper of the returned JSX. Use
   `withPadding` for simple pages with no inner layout structure.
5. **Check for double-wrapping**: after a wrapper fix, grep the child components for their own
   `Layout.Page` usage and remove it if the parent now provides it. Pay special attention to
   tabs noted as already-compliant in the group description.
6. **Run pre-commit** on modified files before finishing:
   ```bash
   cd /Users/jonasbadalic/code/sentry2 && .venv/bin/pre-commit run --files <file1> [file2 ...]
   ```
7. **Do not** change any logic, props, state, or styling beyond adding `Layout.Page`. This is a
   structural wrapping change only.
