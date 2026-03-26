### A — Root & Standalone Routes

| Parametrized path                                               | Component                                    | Layout.Page                                                                            |
| --------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------- |
| `/auth/login/`                                                  | `sentry/views/auth/login`                    | NO                                                                                     |
| `/` (index)                                                     | `sentry/views/app/root`                      | NO                                                                                     |
| `/accept/:orgId/:memberId/:token/`                              | `sentry/views/acceptOrganizationInvite`      | NO                                                                                     |
| `/accept/:memberId/:token/`                                     | `sentry/views/acceptOrganizationInvite`      | NO                                                                                     |
| `/accept-transfer/`                                             | `sentry/views/acceptProjectTransfer`         | NO                                                                                     |
| `/extensions/external-install/:integrationSlug/:installationId` | `sentry/views/integrationOrganizationLink`   | NO                                                                                     |
| `/extensions/:integrationSlug/link/`                            | `sentry/views/integrationOrganizationLink`   | NO                                                                                     |
| `/sentry-apps/:sentryAppSlug/external-install/`                 | `sentry/views/sentryAppExternalInstallation` | NO                                                                                     |
| `/share/issue/:shareId/`                                        | `sentry/views/sharedGroupDetails`            | NO                                                                                     |
| `/organizations/:orgId/share/issue/:shareId/`                   | `sentry/views/sharedGroupDetails`            | NO                                                                                     |
| `/unsubscribe/project/:id/`                                     | `sentry/views/unsubscribe/project`           | NO                                                                                     |
| `/unsubscribe/:orgId/project/:id/`                              | `sentry/views/unsubscribe/project`           | NO                                                                                     |
| `/unsubscribe/issue/:id/`                                       | `sentry/views/unsubscribe/issue`             | NO                                                                                     |
| `/unsubscribe/:orgId/issue/:id/`                                | `sentry/views/unsubscribe/issue`             | NO                                                                                     |
| `/organizations/new/`                                           | `sentry/views/organizationCreate`            | NO                                                                                     |
| `/organizations/:orgId/data-export/:dataExportId`               | `sentry/views/dataExport/dataDownload`       | NO                                                                                     |
| `/organizations/:orgId/disabled-member/`                        | `sentry/views/disabledMember`                | NO                                                                                     |
| `/restore/`                                                     | `sentry/views/organizationRestore`           | NO                                                                                     |
| `/organizations/:orgId/restore/`                                | `sentry/views/organizationRestore`           | NO                                                                                     |
| `/join-request/`                                                | `sentry/views/organizationJoinRequest`       | NO                                                                                     |
| `/join-request/:orgId/`                                         | `sentry/views/organizationJoinRequest`       | NO                                                                                     |
| `/relocation/:step/`                                            | `sentry/views/relocation`                    | YES (disabled-feature fallback only; `relocation.tsx` itself does not use Layout.Page) |
| `/onboarding/:orgId/:step/`                                     | `sentry/views/onboarding/onboarding`         | NO                                                                                     |
| `/organizations/:orgId/projects/:projectId/events/:eventId/`    | `sentry/views/projectEventRedirect`          | YES                                                                                    |

**Parent wrapper:** `AppBodyContentRoute` (`sentry/views/app/appBodyContent`) — uses Layout.Page: NO

**Missing count:** 21 routes (all non-relocation, non-projectEventRedirect routes) do not use Layout.Page.

**Notes:**

- `AppBodyContentRoute` is a thin pass-through wrapper (`<Outlet />`); it does not inject Layout.Page, so children are NOT inherited-compliant.
- `sentry/views/relocation` (`index.tsx`) references `Layout.Page` only in its `renderDisabled` fallback for the feature flag gate. The main rendered component (`relocation.tsx`) does not use Layout.Page.
- `sentry/views/projectEventRedirect` uses `Layout.Page withPadding` directly in its render (line 125).
- `sentry/views/auth/login` is served via `AuthLayoutRoute` (not `AppBodyContentRoute`) when `EXPERIMENTAL_SPA` is true; neither path uses Layout.Page.
- Routes for `integrationOrganizationLink` and `disabledMember` are nested under `OrganizationContainerRoute`, but that wrapper was not checked here — only the leaf component matters per the assignment scope.
- `projectEventRedirect` appears at both `/organizations/:orgId/projects/:projectId/events/:eventId/` (via `projectsRoutes` with `withOrgPath: true`) and also inside a non-org path block around line 2949 (inside a legacy org-scoped route group).
