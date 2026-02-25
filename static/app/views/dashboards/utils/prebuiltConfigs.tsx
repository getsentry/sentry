import {type DashboardDetails} from 'sentry/views/dashboards/types';
import {AI_AGENTS_MODELS_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/ai/aiAgentsModels';
import {AI_AGENTS_OVERVIEW_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/ai/aiAgentsOverview';
import {AI_AGENTS_TOOLS_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/ai/aiAgentsTools';
import {MCP_OVERVIEW_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/ai/mcpOverview';
import {MCP_PROMPTS_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/ai/mcpPrompts';
import {MCP_RESOURCES_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/ai/mcpResources';
import {MCP_TOOLS_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/ai/mcpTools';
import {BACKEND_OVERVIEW_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/backendOverview/backendOverview';
import {FRONTEND_ASSETS_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/frontendAssets/frontendAssets';
import {FRONTEND_ASSETS_SUMMARY_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/frontendAssets/frontendAssetsSummary';
import {FRONTEND_OVERVIEW_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/frontendOverview/frontendOverview';
import {HTTP_DOMAIN_SUMMARY_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/http/domainSummary';
import {HTTP_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/http/http';
import {LARAVEL_OVERVIEW_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/laravelOverview/laravelOverview';
import {MOBILE_SESSION_HEALTH_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/mobileSessionHealth';
import {MOBILE_VITALS_APP_STARTS_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/mobileVitals/appStarts';
import {MOBILE_VITALS_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/mobileVitals/mobileVitals';
import {MOBILE_VITALS_SCREEN_LOADS_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/mobileVitals/screenLoads';
import {MOBILE_VITALS_SCREEN_RENDERING_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/mobileVitals/screenRendering';
import {NEXTJS_FRONTEND_OVERVIEW_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/nextJsOverview/nextJsOverview';
import {QUERIES_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/queries/queries';
import {QUERIES_SUMMARY_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/queries/querySummary';
import {SESSION_HEALTH_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/sessionHealth';
import {WEB_VITALS_SUMMARY_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/webVitals/pageSummary';
import {WEB_VITALS_PREBUILT_CONFIG} from 'sentry/views/dashboards/utils/prebuiltConfigs/webVitals/webVitals';

export enum PrebuiltDashboardId {
  FRONTEND_SESSION_HEALTH = 1,
  BACKEND_QUERIES = 2,
  BACKEND_QUERIES_SUMMARY = 3,
  HTTP = 4,
  HTTP_DOMAIN_SUMMARY = 5,
  WEB_VITALS = 6,
  WEB_VITALS_SUMMARY = 7,
  MOBILE_VITALS = 8,
  MOBILE_VITALS_APP_STARTS = 9,
  MOBILE_VITALS_SCREEN_LOADS = 10,
  MOBILE_VITALS_SCREEN_RENDERING = 11,
  BACKEND_OVERVIEW = 12,
  MOBILE_SESSION_HEALTH = 13,
  FRONTEND_OVERVIEW = 14,
  NEXTJS_FRONTEND_OVERVIEW = 15,
  AI_AGENTS_OVERVIEW = 16,
  AI_AGENTS_MODELS = 17,
  AI_AGENTS_TOOLS = 18,
  MCP_OVERVIEW = 19,
  MCP_TOOLS = 20,
  MCP_RESOURCES = 21,
  MCP_PROMPTS = 22,
  LARAVEL_OVERVIEW = 23,
  FRONTEND_ASSETS = 24,
  FRONTEND_ASSETS_SUMMARY = 25,
}

export type PrebuiltDashboard = Omit<DashboardDetails, 'id'>;

// NOTE: These configs must be in sync with the prebuilt dashboards declared in
// the backend in the `PREBUILT_DASHBOARDS` constant.
export const PREBUILT_DASHBOARDS: Record<PrebuiltDashboardId, PrebuiltDashboard> = {
  [PrebuiltDashboardId.FRONTEND_SESSION_HEALTH]: SESSION_HEALTH_PREBUILT_CONFIG,
  [PrebuiltDashboardId.BACKEND_QUERIES]: QUERIES_PREBUILT_CONFIG,
  [PrebuiltDashboardId.BACKEND_QUERIES_SUMMARY]: QUERIES_SUMMARY_PREBUILT_CONFIG,
  [PrebuiltDashboardId.HTTP]: HTTP_PREBUILT_CONFIG,
  [PrebuiltDashboardId.HTTP_DOMAIN_SUMMARY]: HTTP_DOMAIN_SUMMARY_PREBUILT_CONFIG,
  [PrebuiltDashboardId.WEB_VITALS]: WEB_VITALS_PREBUILT_CONFIG,
  [PrebuiltDashboardId.WEB_VITALS_SUMMARY]: WEB_VITALS_SUMMARY_PREBUILT_CONFIG,
  [PrebuiltDashboardId.MOBILE_VITALS]: MOBILE_VITALS_PREBUILT_CONFIG,
  [PrebuiltDashboardId.BACKEND_OVERVIEW]: BACKEND_OVERVIEW_PREBUILT_CONFIG,
  [PrebuiltDashboardId.MOBILE_VITALS_APP_STARTS]:
    MOBILE_VITALS_APP_STARTS_PREBUILT_CONFIG,
  [PrebuiltDashboardId.MOBILE_VITALS_SCREEN_LOADS]:
    MOBILE_VITALS_SCREEN_LOADS_PREBUILT_CONFIG,
  [PrebuiltDashboardId.MOBILE_VITALS_SCREEN_RENDERING]:
    MOBILE_VITALS_SCREEN_RENDERING_PREBUILT_CONFIG,
  [PrebuiltDashboardId.MOBILE_SESSION_HEALTH]: MOBILE_SESSION_HEALTH_PREBUILT_CONFIG,
  [PrebuiltDashboardId.FRONTEND_OVERVIEW]: FRONTEND_OVERVIEW_PREBUILT_CONFIG,
  [PrebuiltDashboardId.NEXTJS_FRONTEND_OVERVIEW]:
    NEXTJS_FRONTEND_OVERVIEW_PREBUILT_CONFIG,
  [PrebuiltDashboardId.AI_AGENTS_MODELS]: AI_AGENTS_MODELS_PREBUILT_CONFIG,
  [PrebuiltDashboardId.AI_AGENTS_TOOLS]: AI_AGENTS_TOOLS_PREBUILT_CONFIG,
  [PrebuiltDashboardId.MCP_TOOLS]: MCP_TOOLS_PREBUILT_CONFIG,
  [PrebuiltDashboardId.MCP_RESOURCES]: MCP_RESOURCES_PREBUILT_CONFIG,
  [PrebuiltDashboardId.MCP_PROMPTS]: MCP_PROMPTS_PREBUILT_CONFIG,
  [PrebuiltDashboardId.AI_AGENTS_OVERVIEW]: AI_AGENTS_OVERVIEW_PREBUILT_CONFIG,
  [PrebuiltDashboardId.MCP_OVERVIEW]: MCP_OVERVIEW_PREBUILT_CONFIG,
  [PrebuiltDashboardId.LARAVEL_OVERVIEW]: LARAVEL_OVERVIEW_PREBUILT_CONFIG,
  [PrebuiltDashboardId.FRONTEND_ASSETS]: FRONTEND_ASSETS_PREBUILT_CONFIG,
  [PrebuiltDashboardId.FRONTEND_ASSETS_SUMMARY]: FRONTEND_ASSETS_SUMMARY_PREBUILT_CONFIG,
};
