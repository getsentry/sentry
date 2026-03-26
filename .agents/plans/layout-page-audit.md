# Layout.Page Audit Plan

Identify all routes in `static/app/router/routes.tsx` that do **not** use `Layout.Page` as a
content wrapper anywhere in their render tree.

## Background

`Layout.Page` is the standard page container exported from
`sentry/components/layouts/thirds`. It renders as a `<main>` element and provides responsive
page-frame styling, padding, and navigation context awareness.

A route is considered **compliant** if `Layout.Page` appears anywhere in its render tree —
either in the leaf component itself or in a parent layout wrapper that renders `<Outlet />`.

## How to Detect Layout.Page Usage

A component counts as **using** `Layout.Page` if **any** of the following are true in the file:

1. **Direct JSX usage** — the string `Layout.Page` appears in JSX:

   ```tsx
   <Layout.Page> … </Layout.Page>
   ```

2. **Styled extension** — `Layout.Page` is passed to `styled()` and the resulting component
   is rendered. The alias can be anything:

   ```tsx
   const StyledPage = styled(Layout.Page)`…`;
   // rendered as <StyledPage> — still counts
   ```

   Search for: `styled(Layout.Page)`

3. **Re-exported or aliased component** — rare, but possible:
   ```tsx
   const Page = Layout.Page;
   // rendered as <Page>
   ```
   Search for: `= Layout.Page` (assignment, not JSX)

**Grep patterns to run on each file** (all three must be checked):

```
Layout\.Page          # covers cases 1 and 3
styled\(Layout\.Page  # covers case 2
```

If none of these patterns match, the file does **not** use `Layout.Page` and the route is
**non-compliant** (unless a parent wrapper in the route tree is compliant).

Import pattern for reference:

```tsx
import * as Layout from 'sentry/components/layouts/thirds';
```

## Routes File

`static/app/router/routes.tsx` — 3 001 lines, ~310 lazy-loaded route components.

## Known Parent Wrappers (check these first)

If a wrapper already renders `Layout.Page` then all its `<Outlet />` children are
**inherited-compliant** and individual leaf components do not need to wrap again.

| Wrapper                    | Import                                                    | Status                           |
| -------------------------- | --------------------------------------------------------- | -------------------------------- |
| `SettingsWrapper`          | `sentry/views/settings/components/settingsWrapper`        | **confirmed** uses `Layout.Page` |
| `OrganizationStatsWrapper` | `sentry/views/organizationStats/organizationStatsWrapper` | needs check                      |
| `detectorViewContainer`    | `sentry/views/detectors/detectorViewContainer`            | needs check                      |
| `adminLayout`              | `sentry/views/admin/adminLayout`                          | needs check                      |
| `AppBodyContentRoute`      | `sentry/views/app/appBodyContent`                         | needs check                      |

## Route Groups

| #   | Const                        | Line | Path prefix                                 | ~Components                |
| --- | ---------------------------- | ---- | ------------------------------------------- | -------------------------- |
| 1   | `experimentalSpaChildRoutes` | 132  | `/auth/login/`                              | 2                          |
| 2   | `rootChildren`               | 150  | `/accept/`, `/share/`, `/onboarding/`, etc. | 15                         |
| 3   | `accountSettingsRoutes`      | 485  | `settings/account/`                         | 20                         |
| 4   | `projectSettingsRoutes`      | 782  | `settings/projects/:proj/`                  | 30                         |
| 5   | `statsRoutes`                | 812  | `/stats/`                                   | 5                          |
| 6   | `orgSettingsRoutes`          | 827  | `settings/:org/`                            | 25                         |
| 7   | `settingsRoutes`             | 1243 | `/settings/`                                | wrapper + a few            |
| 8   | `projectsRoutes`             | 1295 | `/projects/`                                | 5                          |
| 9   | `dashboardRoutes`            | 1392 | `/dashboards/`                              | 10                         |
| 10  | `alertRoutes`                | 1591 | `/alerts/`                                  | 20                         |
| 11  | `monitorRoutes`              | 1607 | `/monitors/`                                | 10 + automations/detectors |
| 12  | `replayRoutes`               | 1655 | `/replays/`                                 | 5                          |
| 13  | `releasesRoutes`             | 1696 | `/releases/`                                | 10                         |
| 14  | `discoverRoutes`             | 1738 | `/discover/`                                | 5                          |
| 15  | `moduleRoutes`               | 1828 | `/insights/…`                               | 30                         |
| 16  | `domainViewRoutes`           | 1964 | `/performance/`, `/frontend/`, etc.         | 30                         |
| 17  | `performanceRoutes`          | 2187 | `/performance/`                             | 10                         |
| 18  | `tracesRoutes`               | 2205 | `/traces/`                                  | 5                          |
| 19  | `profilingRoutes`            | 2265 | `/profiling/`                               | 10                         |
| 20  | `exploreRoutes`              | 2332 | `/explore/`                                 | 10                         |
| 21  | `preprodRoutes`              | 2390 | `/preprod/`                                 | 5                          |
| 22  | `pullRequestRoutes`          | 2406 | `/pull-requests/`                           | 5                          |
| 23  | `feedbackv2Routes`           | 2420 | `/feedback/`                                | 5                          |
| 24  | `issueRoutes`                | 2579 | `/issues/`                                  | 20                         |
| 25  | `adminManageRoutes`          | 2639 | `/manage/`                                  | 10                         |

Redirect-only routes (`redirectTo`) and `routeHook()` placeholders require no analysis.

## Sub-Agent Assignments

### Agent A — Root & Standalone Routes

**Routes file lines:** 132–325

Components to check:

- `sentry/views/auth/login`
- `sentry/views/app/root`
- `sentry/views/acceptOrganizationInvite`
- `sentry/views/acceptProjectTransfer`
- `sentry/views/integrationOrganizationLink`
- `sentry/views/sentryAppExternalInstallation`
- `sentry/views/sharedGroupDetails`
- `sentry/views/unsubscribe/project`
- `sentry/views/unsubscribe/issue`
- `sentry/views/organizationCreate`
- `sentry/views/dataExport/dataDownload`
- `sentry/views/disabledMember`
- `sentry/views/organizationRestore`
- `sentry/views/organizationJoinRequest`
- `sentry/views/relocation`
- `sentry/views/onboarding/onboarding`
- `sentry/views/projectEventRedirect`

Also check parent: `sentry/views/app/appBodyContent` (`AppBodyContentRoute`).

---

### Agent B — Settings Routes

**Routes file lines:** 327–1242

First check `sentry/views/settings/components/settingsWrapper` — it is known to use
`Layout.Page`. If confirmed, all children rendered via `<Outlet />` are **inherited-compliant**.

Still check for any components that break out of the Outlet pattern or render independently.

Key layout wrappers inside settings to check:

- `sentry/views/settings/account/accountSettingsLayout`
- `sentry/views/settings/account/accountSecurity/accountSecurityWrapper`

Spot-check a sample of ~10 leaf components from:

- `sentry/views/settings/account/`
- `sentry/views/settings/organizationGeneralSettings`
- `sentry/views/settings/projectGeneralSettings`

---

### Agent C — Stats, Projects, Dashboards

**Routes file lines:** 812–1395

Components to check:

- `sentry/views/organizationStats/organizationStatsWrapper` (parent wrapper — check first)
- `sentry/views/organizationStats/` children
- `sentry/views/projects/` (index + projectsChildren)
- `sentry/views/dashboards/` (manage, create, createFromSeer, detail)
- `sentry/views/dashboards/widgetBuilder/`

---

### Agent D — Alerts & Monitors

**Routes file lines:** 1396–1654

Components to check:

- `sentry/views/alerts/` — all `alertChildRoutes` components (~20)
- `sentry/views/detectors/detectorViewContainer` (parent wrapper — check first)
- `sentry/views/detectors/list/` (myMonitors, error, metric, cron, uptime, mobileBuild)
- `sentry/views/automations/routes` — follow import and check all components

---

### Agent E — Replays, Releases, Discover

**Routes file lines:** 1655–1827

Components to check:

- `sentry/views/replays/` (all replayRoutes children)
- `sentry/views/releases/` (all releasesRoutes children)
- `sentry/views/discover/` (all discoverRoutes children)

---

### Agent F — Insights / Module Routes

**Routes file lines:** 1828–2186

Components to check:

- All `moduleRoutes` entries in `sentry/views/insights/` (~30 components)
- All `domainViewRoutes` children — frontend, backend, mobile, agents, mcp, conversations
  landing pages and their sub-routes

---

### Agent G — Performance, Traces, Profiling, Explore, Pre-prod

**Routes file lines:** 2187–2420

Components to check:

- `sentry/views/performance/` (performanceRoutes children, ~10)
- Traces routes children
- `sentry/views/profiling/` (profilingRoutes children, ~10)
- `sentry/views/explore/` (exploreRoutes children, ~10)
- `sentry/views/preprod/` (preprodRoutes children)
- Pull-request routes children

---

### Agent H — Feedback & Issues

**Routes file lines:** 2420–2583

Components to check:

- `sentry/views/feedback/` (feedbackv2Routes children)
- `sentry/views/issueDetails/` (groupEventDetails, groupReplays, groupTags, etc.)
- `sentry/views/issueList/` (overview + taxonomy variants)

---

### Agent I — Admin

**Routes file lines:** 2585–2643

Components to check:

- `sentry/views/admin/adminLayout` (parent wrapper — check first)
- `sentry/views/admin/adminEnvironment`
- `sentry/views/admin/adminRelays`
- `sentry/views/admin/adminOrganizations`
- `sentry/views/admin/adminProjects`
- `sentry/views/admin/adminSettings`
- `sentry/views/admin/adminUsers`
- `sentry/views/admin/adminUserEdit`
- `sentry/views/admin/adminMail`
- `sentry/views/admin/adminPackages`
- `sentry/views/admin/adminWarnings`

---

## Output Format (required from each agent)

```
### <Agent Letter> — <Area Name>

| Parametrized path | Component | Layout.Page |
|-------------------|-----------|-------------|
| /organizations/:orgId/issues/:groupId/ | sentry/views/… | YES |
| /organizations/:orgId/issues/:groupId/ | sentry/views/… | NO |
| /organizations/:orgId/settings/        | sentry/views/… | INHERITED (SettingsWrapper) |
| /organizations/:orgId/old-path/        | —              | REDIRECT — skip |

**Parent wrapper:** <WrapperName> — uses Layout.Page: YES/NO
**Missing count:** N
**Notes:** e.g. "uses styled(Layout.Page) as StyledLayoutPage", "conditionally wraps based on feature flag", etc.
```

The parametrized path must be the **full resolved path** as it would appear in the browser,
including any org/project/id segments from parent route segments. Reconstruct it by walking up
the route tree and joining all `path` segments. For `withOrgPath: true` routes, prefix with
`/organizations/:orgId`.

## Aggregation Step

After all agents complete, collect every row where `Layout.Page = NO` and sort by area.
That final list is the remediation backlog.
