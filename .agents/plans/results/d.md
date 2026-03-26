### D — Alerts & Monitors

| Parametrized path                                                         | Component                                                                                | Layout.Page |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------- |
| /organizations/:orgId/alerts/                                             | sentry/views/alerts (index.tsx — AlertsContainer)                                        | NO          |
| /organizations/:orgId/alerts/ (index)                                     | sentry/views/alerts/list/incidents                                                       | NO          |
| /organizations/:orgId/alerts/rules/ (index)                               | sentry/views/alerts/list/rules/alertRulesList                                            | NO          |
| /organizations/:orgId/alerts/rules/details/:ruleId/                       | sentry/views/alerts/workflowEngineRedirectWrappers/metricAlertRuleDetails                | NO          |
| /organizations/:orgId/alerts/rules/:projectId/                            | sentry/views/alerts/builder/projectProvider                                              | NO          |
| /organizations/:orgId/alerts/rules/:projectId/:ruleId/                    | sentry/views/alerts/workflowEngineRedirectWrappers/alertEdit                             | NO          |
| /organizations/:orgId/alerts/rules/:projectId/:ruleId/details/            | sentry/views/alerts/workflowEngineRedirectWrappers/issueAlertRuleDetails                 | NO          |
| /organizations/:orgId/alerts/rules/uptime/                                | sentry/views/alerts/rules/uptime (index.tsx — UptimeContainer, wrapper)                  | NO          |
| /organizations/:orgId/alerts/rules/uptime/:projectId/:detectorId/details/ | sentry/views/alerts/workflowEngineRedirectWrappers/uptimeAlertRuleDetails                | NO          |
| /organizations/:orgId/alerts/rules/uptime/existing-or-create/             | sentry/views/alerts/workflowEngineRedirectWrappers/uptimeExistingOrCreate                | NO          |
| /organizations/:orgId/alerts/rules/crons/                                 | sentry/views/alerts/rules/crons (index.tsx — CronsContainer, wrapper)                    | NO          |
| /organizations/:orgId/alerts/rules/crons/:projectId/:monitorSlug/details/ | sentry/views/alerts/rules/crons/details                                                  | YES         |
| /organizations/:orgId/alerts/metric-rules/:projectId/:ruleId/             | sentry/views/alerts/workflowEngineRedirectWrappers/metricAlertRuleEdit                   | NO          |
| /organizations/:orgId/alerts/wizard/                                      | sentry/views/alerts/workflowEngineRedirectWrappers/alertBuilderProjectProvider (wrapper) | NO          |
| /organizations/:orgId/alerts/wizard/ (index)                              | sentry/views/alerts/wizard                                                               | YES         |
| /organizations/:orgId/alerts/new/:alertType/                              | sentry/views/alerts/workflowEngineRedirectWrappers/alertCreate                           | NO          |
| /organizations/:orgId/alerts/:alertId/                                    | sentry/views/alerts/workflowEngineRedirectWrappers/incident                              | NO          |
| /organizations/:orgId/alerts/:projectId/new/                              | sentry/views/alerts/create                                                               | NO          |
| /organizations/:orgId/alerts/:projectId/wizard/                           | sentry/views/alerts/wizard                                                               | YES         |
| /organizations/:orgId/alerts/crons-rules/:projectId/:monitorSlug/         | sentry/views/alerts/edit                                                                 | NO          |
| /organizations/:orgId/monitors/                                           | sentry/views/detectors/detectorViewContainer                                             | NO          |
| /organizations/:orgId/monitors/monitors/ (index)                          | sentry/views/detectors/list/allMonitors                                                  | NO          |
| /organizations/:orgId/monitors/monitors/new (index)                       | sentry/views/detectors/new                                                               | NO          |
| /organizations/:orgId/monitors/monitors/new/settings/                     | sentry/views/detectors/new-settings                                                      | YES         |
| /organizations/:orgId/monitors/monitors/:detectorId/ (index)              | sentry/views/detectors/detail                                                            | NO          |
| /organizations/:orgId/monitors/monitors/:detectorId/edit/                 | sentry/views/detectors/edit                                                              | NO          |
| /organizations/:orgId/monitors/my-monitors/                               | sentry/views/detectors/list/myMonitors                                                   | NO          |
| /organizations/:orgId/monitors/errors/                                    | sentry/views/detectors/list/error                                                        | NO          |
| /organizations/:orgId/monitors/metrics/                                   | sentry/views/detectors/list/metric                                                       | NO          |
| /organizations/:orgId/monitors/crons/                                     | sentry/views/detectors/list/cron                                                         | NO          |
| /organizations/:orgId/monitors/uptime/                                    | sentry/views/detectors/list/uptime                                                       | NO          |
| /organizations/:orgId/monitors/mobile-builds/                             | sentry/views/detectors/list/mobileBuild                                                  | NO          |
| /organizations/:orgId/monitors/alerts/ (index)                            | sentry/views/automations/list                                                            | NO          |
| /organizations/:orgId/monitors/alerts/new (index)                         | sentry/views/automations/new                                                             | YES         |
| /organizations/:orgId/monitors/alerts/:automationId/ (index)              | sentry/views/automations/detail                                                          | NO          |
| /organizations/:orgId/monitors/alerts/:automationId/edit/                 | sentry/views/automations/edit                                                            | YES         |

**Parent wrapper: alerts/index.tsx (AlertsContainer)** — uses Layout.Page: NO (renders NoProjectMessage + Outlet only)

**Parent wrapper: detectorViewContainer** — uses Layout.Page: NO (renders PageFiltersContainer + Outlet only; children do NOT inherit Layout.Page)

**Missing count:** 30 (routes where Layout.Page is absent from the leaf component and no parent wrapper provides it)

**Notes:**

- `sentry/views/alerts` (AlertsContainer) is a thin wrapper — no Layout.Page, just NoProjectMessage + Outlet.
- `detectorViewContainer` does NOT use Layout.Page; it only provides PageFiltersContainer + Outlet. So all detector list children (allMonitors, error, metric, cron, uptime, mobileBuild, myMonitors, detail, edit, new) are non-compliant.
- `sentry/views/alerts/rules/uptime/index.tsx` (UptimeContainer) is a layout wrapper with no Layout.Page — only PageFiltersContainer + Outlet.
- `sentry/views/alerts/rules/crons/index.tsx` (CronsContainer) is a layout wrapper with no Layout.Page — only PageFiltersContainer + Outlet.
- Components confirmed to use Layout.Page directly: `alerts/wizard`, `alerts/rules/crons/details`, `alerts/rules/uptime/details` (matched via parent route as `uptimeAlertRuleDetails` redirect wrapper calls this), `detectors/new-settings`, `automations/new`, `automations/edit`.
- The `workflowEngineRedirectWrappers` wrappers (metricAlertRuleDetails, alertEdit, issueAlertRuleDetails, uptimeAlertRuleDetails, uptimeExistingOrCreate, alertBuilderProjectProvider, alertCreate, incident, metricAlertRuleEdit) are all redirect/thin wrappers with no Layout.Page.
- The `automations/list` and `automations/detail` components do NOT use Layout.Page.
- The `alertChildRoutes` function covers approximately 20 child routes total; the majority do not use Layout.Page.
