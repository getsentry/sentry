### G — Performance, Traces, Profiling, Explore, Pre-prod

| Parametrized path                                                                 | Component                                                                 | Layout.Page                                                      |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| /organizations/:orgId/performance/                                                | sentry/views/performance/index.tsx                                        | YES (Layout.Page in renderDisabled; renders Outlet for children) |
| /organizations/:orgId/performance/trace/:traceSlug/                               | sentry/views/performance/newTraceDetails/index.tsx                        | YES (styled(Layout.Page))                                        |
| /organizations/:orgId/performance/summary/                                        | sentry/views/performance/transactionSummary/layout.tsx (wrapper, Outlet)  | NO                                                               |
| /organizations/:orgId/performance/summary/ [index]                                | sentry/views/performance/transactionSummary/transactionOverview/index.tsx | NO                                                               |
| /organizations/:orgId/performance/summary/replays/                                | sentry/views/performance/transactionSummary/transactionReplays/index.tsx  | YES                                                              |
| /organizations/:orgId/performance/summary/tags/                                   | sentry/views/performance/transactionSummary/transactionTags/index.tsx     | NO                                                               |
| /organizations/:orgId/performance/summary/events/                                 | sentry/views/performance/transactionSummary/transactionEvents/index.tsx   | NO                                                               |
| /organizations/:orgId/performance/summary/profiles/                               | sentry/views/performance/transactionSummary/transactionProfiles/index.tsx | NO                                                               |
| /organizations/:orgId/traces/                                                     | sentry/views/traces/index.tsx                                             | NO (Outlet wrapper, no Layout.Page)                              |
| /organizations/:orgId/traces/ [index]                                             | sentry/views/traces/content.tsx                                           | NO                                                               |
| /organizations/:orgId/traces/trace/:traceSlug/                                    | sentry/views/performance/newTraceDetails/index.tsx                        | YES (styled(Layout.Page))                                        |
| /organizations/:orgId/traces/compare/                                             | sentry/views/explore/multiQueryMode/index.tsx                             | YES                                                              |
| /organizations/:orgId/profiling/                                                  | sentry/views/profiling/index.tsx                                          | YES (Layout.Page in renderDisabled; renders Outlet)              |
| /organizations/:orgId/profiling/ [index]                                          | sentry/views/profiling/content.tsx                                        | YES                                                              |
| /organizations/:orgId/profiling/summary/:projectId/                               | sentry/views/profiling/profileSummary/index.tsx                           | NO                                                               |
| /organizations/:orgId/profiling/profile/:projectId/differential-flamegraph/       | sentry/views/profiling/differentialFlamegraph.tsx                         | NO                                                               |
| /organizations/:orgId/profiling/profile/:projectId/                               | sentry/views/profiling/continuousProfileProvider.tsx (Outlet wrapper)     | NO                                                               |
| /organizations/:orgId/profiling/profile/:projectId/flamegraph/                    | sentry/views/profiling/continuousProfileFlamegraph.tsx                    | YES (styled(Layout.Page))                                        |
| /organizations/:orgId/profiling/profile/:projectId/:eventId/                      | sentry/views/profiling/transactionProfileProvider.tsx (Outlet wrapper)    | NO                                                               |
| /organizations/:orgId/profiling/profile/:projectId/:eventId/flamegraph/           | sentry/views/profiling/profileFlamechart.tsx                              | YES (styled(Layout.Page))                                        |
| /organizations/:orgId/explore/                                                    | no wrapper component (exploreRoutes has no component)                     | N/A                                                              |
| /organizations/:orgId/explore/ [index]                                            | sentry/views/explore/indexRedirect.tsx                                    | NO                                                               |
| /organizations/:orgId/explore/profiling/                                          | sentry/views/profiling/index.tsx (reused, Outlet)                         | YES (renderDisabled)                                             |
| /organizations/:orgId/explore/traces/                                             | sentry/views/traces/index.tsx (reused, Outlet)                            | NO                                                               |
| /organizations/:orgId/explore/logs/                                               | sentry/views/explore/logs/index.tsx (Outlet wrapper)                      | NO                                                               |
| /organizations/:orgId/explore/logs/ [index]                                       | sentry/views/explore/logs/content.tsx                                     | YES                                                              |
| /organizations/:orgId/explore/metrics/                                            | sentry/views/explore/metrics/index.tsx (Outlet wrapper)                   | NO                                                               |
| /organizations/:orgId/explore/metrics/ [index]                                    | sentry/views/explore/metrics/content.tsx                                  | YES                                                              |
| /organizations/:orgId/explore/conversations/                                      | sentry/views/insights/pages/conversations/layout.tsx (Outlet wrapper)     | NO                                                               |
| /organizations/:orgId/explore/conversations/ [index]                              | sentry/views/insights/pages/conversations/overview.tsx                    | NO                                                               |
| /organizations/:orgId/explore/saved-queries/                                      | sentry/views/explore/savedQueries/index.tsx                               | YES                                                              |
| /organizations/:orgId/preprod/                                                    | sentry/views/preprod/index.tsx                                            | YES (Layout.Page in renderDisabled; renders Outlet)              |
| /organizations/:orgId/preprod/size/:artifactId/                                   | sentry/views/preprod/buildDetails/buildDetails.tsx                        | YES                                                              |
| /organizations/:orgId/preprod/install/:artifactId/                                | sentry/views/preprod/install/installPage.tsx                              | YES                                                              |
| /organizations/:orgId/preprod/size/compare/ [index]                               | RouteNotFound (errorHandler)                                              | N/A                                                              |
| /organizations/:orgId/preprod/size/compare/:headArtifactId/                       | sentry/views/preprod/buildComparison/buildComparison.tsx                  | YES                                                              |
| /organizations/:orgId/preprod/size/compare/:headArtifactId/:baseArtifactId/       | sentry/views/preprod/buildComparison/buildComparison.tsx                  | YES                                                              |
| /organizations/:orgId/preprod/snapshots/:snapshotId/                              | sentry/views/preprod/snapshots/snapshots.tsx                              | YES                                                              |
| /organizations/:orgId/preprod/:projectId/:artifactId/                             | sentry/views/preprod/redirects/legacyUrlRedirect.tsx                      | NO                                                               |
| /organizations/:orgId/preprod/:projectId/:artifactId/install/                     | sentry/views/preprod/redirects/legacyUrlRedirect.tsx                      | NO                                                               |
| /organizations/:orgId/preprod/:projectId/compare/:headArtifactId/                 | sentry/views/preprod/redirects/legacyUrlRedirect.tsx                      | NO                                                               |
| /organizations/:orgId/preprod/:projectId/compare/:headArtifactId/:baseArtifactId/ | sentry/views/preprod/redirects/legacyUrlRedirect.tsx                      | NO                                                               |
| /organizations/:orgId/pull/                                                       | sentry/views/pullRequest/index.tsx                                        | YES (Layout.Page in renderDisabled; renders Outlet)              |
| /organizations/:orgId/pull/:repoOrg/:repoName/:prId/                              | sentry/views/pullRequest/details/pullRequestDetails.tsx                   | YES                                                              |

**Missing count:** 16

Routes/components where Layout.Page is absent (not counting layout wrappers that render Outlet, N/A entries, or redirect-only components):

1. `/organizations/:orgId/traces/` index — sentry/views/traces/index.tsx (Outlet-only wrapper)
2. `/organizations/:orgId/traces/` [index content] — sentry/views/traces/content.tsx
3. `/organizations/:orgId/performance/summary/` layout wrapper — sentry/views/performance/transactionSummary/layout.tsx
4. `/organizations/:orgId/performance/summary/` [transactionOverview] — transactionOverview/index.tsx
5. `/organizations/:orgId/performance/summary/tags/` — transactionTags/index.tsx
6. `/organizations/:orgId/performance/summary/events/` — transactionEvents/index.tsx
7. `/organizations/:orgId/performance/summary/profiles/` — transactionProfiles/index.tsx
8. `/organizations/:orgId/profiling/summary/:projectId/` — profileSummary/index.tsx
9. `/organizations/:orgId/profiling/profile/:projectId/differential-flamegraph/` — differentialFlamegraph.tsx
10. `/organizations/:orgId/profiling/profile/:projectId/` (provider) — continuousProfileProvider.tsx
11. `/organizations/:orgId/profiling/profile/:projectId/:eventId/` (provider) — transactionProfileProvider.tsx
12. `/organizations/:orgId/explore/` [index redirect] — indexRedirect.tsx
13. `/organizations/:orgId/explore/traces/` — traces/index.tsx (Outlet-only, no Layout.Page)
14. `/organizations/:orgId/explore/logs/` — explore/logs/index.tsx (Outlet-only)
15. `/organizations/:orgId/explore/metrics/` — explore/metrics/index.tsx (Outlet-only)
16. `/organizations/:orgId/explore/conversations/` — insights/pages/conversations/layout.tsx (Outlet-only) + overview.tsx (no Layout.Page)
17. `/organizations/:orgId/preprod/:projectId/...` (legacy redirect routes) — legacyUrlRedirect.tsx

**Notes:**

- The `exploreRoutes` object has no top-level `component` (no wrapper), so `/organizations/:orgId/explore/` itself has no layout wrapper.
- Several layout-wrapper components (traces/index.tsx, logs/index.tsx, metrics/index.tsx, conversations/layout.tsx, transactionSummary/layout.tsx, continuousProfileProvider.tsx, transactionProfileProvider.tsx) render only `<Outlet />` with no Layout.Page — compliance depends on their children.
- The `traceView` route (`trace/:traceSlug/`) reuses `sentry/views/performance/newTraceDetails/index.tsx` and IS compliant (uses styled(Layout.Page)) wherever it appears (performance, traces, profiling, explore sub-routes).
- Legacy redirect routes in preprod (legacyUrlRedirect.tsx) do not use Layout.Page — they just redirect, so this is acceptable.
- `profiling/differentialFlamegraph.tsx` is a leaf page with no Layout.Page.
- `profiling/profileSummary/index.tsx` is a leaf page with no Layout.Page.
- The `transactionSummary` tab pages (overview, tags, events, profiles) have no Layout.Page in their index.tsx or content.tsx files; the layout.tsx wrapper also has no Layout.Page.
- `conversations/overview.tsx` imports `* as Layout from 'sentry/components/layouts/thirds'` but does not use `Layout.Page`.
