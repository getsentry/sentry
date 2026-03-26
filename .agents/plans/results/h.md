### H — Feedback & Issues

| Parametrized path                                                   | Component                                                       | Layout.Page                                            |
| ------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------ |
| /organizations/:orgId/feedback/                                     | sentry/views/feedback/index (parent wrapper)                    | YES — wraps `<Outlet />` in `<Layout.Page>`            |
| /organizations/:orgId/feedback/ (index)                             | sentry/views/feedback/feedbackListPage                          | YES (inherited via feedback/index parent)              |
| /organizations/:orgId/issues/ (index)                               | sentry/views/issueList/overviewWrapper → issueList/overview     | YES (overview.tsx line 871)                            |
| /organizations/:orgId/issues/errors-and-outages/                    | sentry/views/issueList/pages/errorsOutages                      | YES (renders IssueListOverview which has Layout.Page)  |
| /organizations/:orgId/issues/breached-metrics/                      | sentry/views/issueList/pages/breachedMetrics                    | YES (renders IssueListOverview which has Layout.Page)  |
| /organizations/:orgId/issues/warnings/                              | sentry/views/issueList/pages/warnings                           | YES (renders IssueListOverview which has Layout.Page)  |
| /organizations/:orgId/issues/instrumentation/                       | sentry/views/issueList/pages/instrumentation                    | YES (renders IssueListOverview which has Layout.Page)  |
| /organizations/:orgId/issues/views/                                 | sentry/views/issueList/issueViews/issueViewsList/issueViewsList | YES (line 361)                                         |
| /organizations/:orgId/issues/supergroups/                           | sentry/views/issueList/pages/supergroups                        | YES (line 123)                                         |
| /organizations/:orgId/issues/views/:viewId/                         | sentry/views/issueList/overviewWrapper → issueList/overview     | YES (via IssueListOverview)                            |
| /organizations/:orgId/issues/searches/:searchId/                    | sentry/views/issueList/overviewWrapper → issueList/overview     | YES (via IssueListOverview)                            |
| /organizations/:orgId/issues/:groupId/ (parent)                     | sentry/views/issueDetails/groupDetails                          | NO — renders `<Outlet />` but does NOT use Layout.Page |
| /organizations/:orgId/issues/:groupId/ (index, details tab)         | sentry/views/issueDetails/groupEventDetails/groupEventDetails   | NO                                                     |
| /organizations/:orgId/issues/:groupId/replays/                      | sentry/views/issueDetails/groupReplays (index.tsx)              | YES (line 16)                                          |
| /organizations/:orgId/issues/:groupId/activity/                     | sentry/views/issueDetails/groupEventDetails/groupEventDetails   | NO                                                     |
| /organizations/:orgId/issues/:groupId/events/                       | sentry/views/issueDetails/groupEvents                           | NO                                                     |
| /organizations/:orgId/issues/:groupId/open-periods/                 | sentry/views/issueDetails/groupOpenPeriods                      | NO                                                     |
| /organizations/:orgId/issues/:groupId/uptime-checks/                | sentry/views/issueDetails/groupUptimeChecks                     | NO                                                     |
| /organizations/:orgId/issues/:groupId/check-ins/                    | sentry/views/issueDetails/groupCheckIns                         | NO                                                     |
| /organizations/:orgId/issues/:groupId/distributions/                | sentry/views/issueDetails/groupEventDetails/groupEventDetails   | NO                                                     |
| /organizations/:orgId/issues/:groupId/distributions/:tagKey/        | sentry/views/issueDetails/groupEventDetails/groupEventDetails   | NO                                                     |
| /organizations/:orgId/issues/:groupId/feedback/                     | sentry/views/issueDetails/groupUserFeedback                     | NO                                                     |
| /organizations/:orgId/issues/:groupId/attachments/                  | sentry/views/issueDetails/groupEventAttachments/index           | NO                                                     |
| /organizations/:orgId/issues/:groupId/similar/                      | sentry/views/issueDetails/groupEventDetails/groupEventDetails   | NO                                                     |
| /organizations/:orgId/issues/:groupId/merged/                       | sentry/views/issueDetails/groupEventDetails/groupEventDetails   | NO                                                     |
| /organizations/:orgId/issues/:groupId/events/:eventId/ (+ sub-tabs) | same as parent issueTabs                                        | same as above                                          |
| /organizations/:orgId/issues/feedback/                              | sentry/views/feedback/index (with feedbackV2Children)           | YES — same parent wrapper with Layout.Page             |

**Missing count:** 12

**Notes:**

- `sentry/views/feedback/index` is a parent layout wrapper that uses `Layout.Page` with `<Outlet />`. The child `feedbackListPage` is therefore compliant via inheritance.
- `sentry/views/issueDetails/groupDetails` is the parent wrapper for all issue tab routes (`/issues/:groupId/`). It renders `<Outlet />` but does NOT use `Layout.Page`. None of the individual issue tab components (groupEventDetails, groupEvents, groupOpenPeriods, groupUptimeChecks, groupCheckIns, groupUserFeedback, groupEventAttachments) use `Layout.Page` either, except `groupReplays` which uses its own `Layout.Page`.
- All `issueList` route components (overview, pages/\*, issueViewsList) use `Layout.Page` either directly or by rendering `IssueListOverview`.
- Redirects (`:groupId/tags/`, `:groupId/tags/:tagKey/`, etc.) are not counted as they have no component.
- The `/issues/feedback/` and `/issues/alerts/` nested routes reuse the same feedback/index and alerts parent wrappers respectively.
