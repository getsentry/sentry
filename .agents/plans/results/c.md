### C — Stats, Projects, Dashboards

| Parametrized path                                                                     | Component file                                          | Layout.Page                              |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------- |
| /organizations/:orgId/stats/                                                          | sentry/views/organizationStats/organizationStatsWrapper | NO (Outlet-only wrapper)                 |
| /organizations/:orgId/stats/ (index)                                                  | sentry/views/organizationStats/index.tsx                | NO                                       |
| /organizations/:orgId/stats/issues/                                                   | sentry/views/organizationStats/teamInsights/issues.tsx  | NO                                       |
| /organizations/:orgId/stats/health/                                                   | sentry/views/organizationStats/teamInsights/health.tsx  | NO                                       |
| /organizations/:orgId/stats/ (teamInsights parent)                                    | sentry/views/organizationStats/teamInsights/index.tsx   | NO                                       |
| /organizations/:orgId/projects/                                                       | sentry/views/projects/index.tsx                         | NO (Outlet-only wrapper)                 |
| /organizations/:orgId/projects/ (index)                                               | sentry/views/projectsDashboard/index.tsx                | YES                                      |
| /organizations/:orgId/projects/new/                                                   | sentry/views/projectInstall/newProject.tsx              | NO                                       |
| /organizations/:orgId/projects/:projectId/                                            | sentry/views/projectDetail/projectDetail.tsx            | YES                                      |
| /organizations/:orgId/projects/:projectId/getting-started/                            | sentry/views/projectInstall/gettingStarted.tsx          | YES (styled(Layout.Page))                |
| /organizations/:orgId/dashboards/                                                     | sentry/views/dashboards/index.tsx                       | NO (Outlet-only wrapper, no Layout.Page) |
| /organizations/:orgId/dashboards/ (manage index)                                      | sentry/views/dashboards/manage/index.tsx                | YES                                      |
| /organizations/:orgId/dashboards/new/from-seer/                                       | sentry/views/dashboards/createFromSeer.tsx              | YES                                      |
| /organizations/:orgId/dashboards/new/                                                 | sentry/views/dashboards/create.tsx                      | YES                                      |
| /organizations/:orgId/dashboards/new/:templateId                                      | sentry/views/dashboards/create.tsx                      | YES                                      |
| /organizations/:orgId/dashboard/:dashboardId/                                         | sentry/views/dashboards/view.tsx                        | YES                                      |
| /organizations/:orgId/dashboard/:dashboardId/widget-builder/widget/:widgetIndex/edit/ | sentry/views/dashboards/view.tsx                        | YES (same component)                     |
| /organizations/:orgId/dashboard/:dashboardId/widget-builder/widget/new/               | sentry/views/dashboards/view.tsx                        | YES (same component)                     |
| /organizations/:orgId/dashboard/:dashboardId/widget/:widgetId/                        | sentry/views/dashboards/view.tsx                        | YES (same component)                     |

**Parent wrapper: OrganizationStatsWrapper** (`sentry/views/organizationStats/organizationStatsWrapper.tsx`) — uses Layout.Page: NO. It only renders `<Outlet />` (or a `<Redirect>`). Layout.Page is NOT inherited by Outlet children.

**Parent wrapper: Projects** (`sentry/views/projects/index.tsx`) — uses Layout.Page: NO. Outlet-only wrapper that redirects or renders `<Outlet />`.

**Parent wrapper: DashboardsV2Container** (`sentry/views/dashboards/index.tsx`) — uses Layout.Page: NO. Renders `<Outlet />` (when `dashboards-edit` feature is on) or falls back to `DashboardDetail` inline (which does use Layout.Page in `detail.tsx`).

**Missing count:** 6

**Notes:**

- All Stats child routes (`organizationStats/index.tsx`, `teamInsights/index.tsx`, `teamInsights/issues.tsx`, `teamInsights/health.tsx`) are missing Layout.Page. The wrapper (`OrganizationStatsWrapper`) is a pure Outlet — no Layout.Page there either.
- `sentry/views/projectInstall/newProject.tsx` is missing Layout.Page.
- `sentry/views/projects/index.tsx` is a redirect/Outlet-only wrapper — no Layout.Page (children are individually responsible).
- The dashboards index wrapper (`sentry/views/dashboards/index.tsx`) has no Layout.Page; it is purely an Outlet dispatcher. All concrete dashboard views (manage, create, createFromSeer, view) do use Layout.Page individually.
- The widgetBuilder child routes under `/dashboards/new/` and `/dashboard/:dashboardId/` reuse `create.tsx` and `view.tsx` respectively, which both have Layout.Page.
- The redirect routes (`/organizations/:orgId/dashboards/:dashboardId/` → `/dashboard/:dashboardId/`, `/dashboards/:dashboardId/` → `/dashboard/:dashboardId/`) were excluded as they are redirects only.
