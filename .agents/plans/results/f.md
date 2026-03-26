### F — Insights / Module Routes

| Parametrized path                                                    | Component                                                          | Layout.Page |
| -------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------- |
| /organizations/:orgId/insights/ (index)                              | sentry/views/insights/index                                        | NO          |
| /organizations/:orgId/insights/frontend/ (layout)                    | sentry/views/insights/pages/frontend/layout                        | NO          |
| /organizations/:orgId/insights/frontend/ (index)                     | sentry/views/insights/pages/frontend/frontendOverviewPage          | NO          |
| /organizations/:orgId/insights/frontend/http/                        | sentry/views/insights/http/views/httpLandingPage                   | NO          |
| /organizations/:orgId/insights/frontend/http/domains/                | sentry/views/insights/http/views/httpDomainSummaryPage             | NO          |
| /organizations/:orgId/insights/frontend/pageloads/                   | sentry/views/insights/browser/webVitals/views/webVitalsLandingPage | NO          |
| /organizations/:orgId/insights/frontend/pageloads/overview/          | sentry/views/insights/browser/webVitals/views/pageOverview         | NO          |
| /organizations/:orgId/insights/frontend/assets/                      | sentry/views/insights/browser/resources/views/resourcesLandingPage | NO          |
| /organizations/:orgId/insights/frontend/assets/spans/span/:groupId/  | sentry/views/insights/browser/resources/views/resourceSummaryPage  | NO          |
| /organizations/:orgId/insights/frontend/sessions/                    | sentry/views/insights/sessions/views/overview                      | NO          |
| /organizations/:orgId/insights/backend/ (layout)                     | sentry/views/insights/pages/backend/layout                         | NO          |
| /organizations/:orgId/insights/backend/ (index)                      | sentry/views/insights/pages/backend/backendOverviewPage            | NO          |
| /organizations/:orgId/insights/backend/http/                         | sentry/views/insights/http/views/httpLandingPage                   | NO          |
| /organizations/:orgId/insights/backend/http/domains/                 | sentry/views/insights/http/views/httpDomainSummaryPage             | NO          |
| /organizations/:orgId/insights/backend/database/                     | sentry/views/insights/database/views/databaseLandingPage           | NO          |
| /organizations/:orgId/insights/backend/database/spans/span/:groupId/ | sentry/views/insights/database/views/databaseSpanSummaryPage       | NO          |
| /organizations/:orgId/insights/backend/caches/                       | sentry/views/insights/cache/views/cacheLandingPage                 | NO          |
| /organizations/:orgId/insights/backend/queues/                       | sentry/views/insights/queues/views/queuesLandingPage               | NO          |
| /organizations/:orgId/insights/backend/queues/destination/           | sentry/views/insights/queues/views/destinationSummaryPage          | NO          |
| /organizations/:orgId/insights/backend/sessions/                     | sentry/views/insights/sessions/views/overview                      | NO          |
| /organizations/:orgId/insights/mobile/ (layout)                      | sentry/views/insights/pages/mobile/layout                          | NO          |
| /organizations/:orgId/insights/mobile/ (index)                       | sentry/views/insights/pages/mobile/mobileOverviewPage              | NO          |
| /organizations/:orgId/insights/mobile/http/                          | sentry/views/insights/http/views/httpLandingPage                   | NO          |
| /organizations/:orgId/insights/mobile/http/domains/                  | sentry/views/insights/http/views/httpDomainSummaryPage             | NO          |
| /organizations/:orgId/insights/mobile/mobile-vitals/                 | sentry/views/insights/mobile/screens/views/screensLandingPage      | YES         |
| /organizations/:orgId/insights/mobile/mobile-vitals/details/         | sentry/views/insights/mobile/screens/views/screenDetailsPage       | YES         |
| /organizations/:orgId/insights/mobile/sessions/                      | sentry/views/insights/sessions/views/overview                      | NO          |
| /organizations/:orgId/insights/mcp/ (layout)                         | sentry/views/insights/pages/mcp/layout                             | NO          |
| /organizations/:orgId/insights/mcp/ (index)                          | sentry/views/insights/pages/mcp/overview                           | NO          |
| /organizations/:orgId/insights/mcp/tools/                            | sentry/views/insights/mcp-tools/views/mcpToolsLandingPage          | NO          |
| /organizations/:orgId/insights/mcp/resources/                        | sentry/views/insights/mcp-resources/views/mcpResourcesLandingPage  | NO          |
| /organizations/:orgId/insights/mcp/prompts/                          | sentry/views/insights/mcp-prompts/views/mcpPromptsLandingPage      | NO          |
| /organizations/:orgId/insights/conversations/\* (redirect)           | sentry/views/insights/pages/conversations/conversationsRedirect    | NO          |
| /organizations/:orgId/insights/ai-agents/ (layout)                   | sentry/views/insights/pages/agents/layout                          | NO          |
| /organizations/:orgId/insights/ai-agents/ (index)                    | sentry/views/insights/pages/agents/overview                        | NO          |
| /organizations/:orgId/insights/ai-agents/models/                     | sentry/views/insights/agentModels/views/modelsLandingPage          | NO          |
| /organizations/:orgId/insights/ai-agents/tools/                      | sentry/views/insights/agentTools/views/toolsLandingPage            | NO          |
| /organizations/:orgId/insights/uptime/                               | sentry/views/insights/uptime/views/overview                        | NO          |
| /organizations/:orgId/insights/crons/                                | sentry/views/insights/crons/views/overview                         | NO          |

**Missing count:** 37 out of 39 routes do not use Layout.Page directly.

**Notes:**

- `DOMAIN_VIEW_BASE_URL = 'insights'`, so all routes are under `/organizations/:orgId/insights/`.
- Domain view sub-path constants: `FRONTEND_LANDING_SUB_PATH = 'frontend'`, `BACKEND_LANDING_SUB_PATH = 'backend'`, `MOBILE_LANDING_SUB_PATH = 'mobile'`, `MCP_LANDING_SUB_PATH = 'mcp'`, `AGENTS_LANDING_SUB_PATH = 'ai-agents'`, `CONVERSATIONS_LANDING_SUB_PATH = 'conversations'`.
- Module base URLs: `http`, `pageloads`, `assets`, `database`, `caches`, `queues`, `mobile-vitals`, `sessions`, `tools` (mcp-tools/agent-tools), `resources` (mcp-resources), `prompts`, `models`.
- The four domain view layout wrappers (frontend, backend, mobile, mcp, agents) all use `<Outlet />` with no `Layout.Page` in the wrapper itself.
- Only two leaf components use `Layout.Page` directly: `screensLandingPage.tsx` (line 267) and `screenDetailsPage.tsx` (line 128) — both in the mobile-vitals module.
- All other module landing pages, domain overview pages, and the index/redirect components do not use `Layout.Page` anywhere in their direct render output.
- The domain-view page headers (`FrontendHeader`, `BackendHeader`, `MobileHeader`, `MCPPageHeader`, `AgentsPageHeader`) all delegate to `DomainViewHeader`, which also does not use `Layout.Page`.
- Routes that are pure redirects (`ai/mcp/ → mcp/`, `ai/* → ai-agents/`, `frontend/uptime/`, `backend/uptime/`, `backend/crons/`) are omitted from the table as they have no component to audit.
