### E — Replays, Releases, Discover

| Parametrized path                                      | Component                                                  | Layout.Page                                                                                        |
| ------------------------------------------------------ | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| /organizations/:orgId/replays/                         | sentry/views/replays/index                                 | NO (passes Outlet without Layout.Page — acts as thin container with redirect logic)                |
| /organizations/:orgId/replays/ (index)                 | sentry/views/replays/list                                  | YES                                                                                                |
| /organizations/:orgId/replays/:replaySlug/             | sentry/views/replays/details                               | YES                                                                                                |
| /organizations/:orgId/releases/                        | sentry/views/releases/index                                | NO (thin Outlet-only container with redirect logic)                                                |
| /organizations/:orgId/releases/ (index)                | sentry/views/releases/list/index                           | YES                                                                                                |
| /organizations/:orgId/releases/:release/               | sentry/views/releases/detail/index                         | YES (Layout.Page in ReleasesDetail; Outlet rendered inside it)                                     |
| /organizations/:orgId/releases/:release/ (index)       | sentry/views/releases/detail/overview/index                | NO (INHERITED via parent detail/index Layout.Page)                                                 |
| /organizations/:orgId/releases/:release/commits/       | sentry/views/releases/detail/commitsAndFiles/commits       | NO (INHERITED via parent detail/index Layout.Page)                                                 |
| /organizations/:orgId/releases/:release/files-changed/ | sentry/views/releases/detail/commitsAndFiles/filesChanged  | NO (INHERITED via parent detail/index Layout.Page)                                                 |
| /organizations/:orgId/releases/:release/builds/        | sentry/views/releases/detail/commitsAndFiles/preprodBuilds | NO (INHERITED via parent detail/index Layout.Page)                                                 |
| /organizations/:orgId/discover/                        | sentry/views/discover/index                                | NO (thin Feature-gate container; Outlet NOT inside Layout.Page)                                    |
| /organizations/:orgId/discover/homepage/               | sentry/views/discover/homepage                             | NO (delegates to Results component from results.tsx which has Layout.Page — INHERITED via Results) |
| /organizations/:orgId/discover/queries/                | sentry/views/discover/landing                              | YES                                                                                                |
| /organizations/:orgId/discover/results/                | sentry/views/discover/results                              | YES                                                                                                |
| /organizations/:orgId/discover/:eventSlug/             | sentry/views/discover/eventDetails                         | NO (only renders loading/error states; navigates away immediately on success — no Layout.Page)     |

**Missing count:** 6 leaf components without Layout.Page (excluding thin containers and components with INHERITED coverage):

- sentry/views/replays/index (container, no Layout.Page, Outlet not inside one)
- sentry/views/releases/index (container, no Layout.Page, Outlet not inside one)
- sentry/views/discover/index (container, no Layout.Page, Outlet not inside one)
- sentry/views/discover/homepage (no Layout.Page; renders Results which does have it — effectively covered)
- sentry/views/discover/eventDetails (no Layout.Page; acts as a redirect shim)

**Notes:**

- `replays/index` and `releases/index` are thin redirect-aware containers that simply pass through via `<Outlet />`; they do not wrap children in Layout.Page. Each child must supply its own.
- `releases/detail/index` (the `:release/` layout route) renders `Layout.Page` around `<Outlet />` via the `ReleasesDetail` component, so all four children (overview, commits, files-changed, builds) inherit Layout.Page.
- `discover/index` passes `<Outlet />` outside of any Layout.Page, so each discover child route must provide its own. `homepage` delegates entirely to the `Results` component (same file as `results.tsx`), which does use Layout.Page — so it is effectively covered.
- `discover/eventDetails` is a redirect shim; it navigates to trace or issue detail pages and never renders a full page layout. It does not use Layout.Page.
- The `traceView` child inside `discoverChildren` (line 1724) is a shared route object defined elsewhere and is not audited here.
