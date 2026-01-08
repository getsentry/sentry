from __future__ import annotations

import logging
from enum import StrEnum, unique

from sentry.utils import metrics

logger = logging.getLogger(__name__)


@unique
class Referrer(StrEnum):
    ALERTRULESERIALIZER_TEST_QUERY_PRIMARY = "alertruleserializer.test_query.primary"
    ALERTRULESERIALIZER_TEST_QUERY = "alertruleserializer.test_query"
    ANOMALY_DETECTION_HISTORICAL_DATA_QUERY = "anomaly_detection_historical_data_query"
    ANOMALY_DETECTION_RETURN_HISTORICAL_ANOMALIES = (
        "anomaly_detection_get_historical_anomalies_query"
    )
    API_ALERTS_ALERT_RULE_CHART_METRICS_ENHANCED = "api.alerts.alert-rule-chart.metrics-enhanced"
    API_ALERTS_ALERT_RULE_CHART = "api.alerts.alert-rule-chart"
    API_ALERTS_CHARTCUTERIE = "api.alerts.chartcuterie"
    API_ENDPOINT_REGRESSION_ALERT_CHARTCUTERIE = "api.endpoint_regression_alerts.chartcuterie"
    API_FUNCTION_REGRESSION_ALERT_CHARTCUTERIE = "api.function_regression_alerts.chartcuterie"
    API_AUTH_TOKEN_EVENTS_METRICS_ENHANCED_PRIMARY = (
        "api.auth-token.events.metrics-enhanced.primary"
    )
    API_AUTH_TOKEN_EVENTS = "api.auth-token.events"
    API_DASHBOARDS_BIGNUMBERWIDGET_METRICS_ENHANCED_PRIMARY = (
        "api.dashboards.bignumberwidget.metrics-enhanced.primary"
    )
    API_DASHBOARDS_BIGNUMBERWIDGET = "api.dashboards.bignumberwidget"
    API_DASHBOARDS_TABLEWIDGET_METRICS_ENHANCED_PRIMARY = (
        "api.dashboards.tablewidget.metrics-enhanced.primary"
    )
    API_DASHBOARDS_TABLEWIDGET_METRICS_ENHANCED_SECONDARY = (
        "api.dashboards.tablewidget.metrics-enhanced.secondary"
    )
    API_DASHBOARDS_TABLEWIDGET = "api.dashboards.tablewidget"
    API_DASHBOARDS_TOP_EVENTS = "api.dashboards.top-events"
    API_DASHBOARDS_WIDGET_AREA_CHART_FIND_TOPN = "api.dashboards.widget.area-chart.find-topn"
    API_DASHBOARDS_WIDGET_AREA_CHART_METRICS_ENHANCED = (
        "api.dashboards.widget.area-chart.metrics-enhanced"
    )
    API_DASHBOARDS_WIDGET_AREA_CHART_FIND_TOPN_METRICS_ENHANCED = (
        "api.dashboards.widget.area-chart.find-topn.metrics-enhanced"
    )
    API_DASHBOARDS_WIDGET_AREA_CHART_FIND_TOPN_METRICS_ENHANCED_PRIMARY = (
        "api.dashboards.widget.area-chart.find-topn.metrics-enhanced.primary"
    )
    API_DASHBOARDS_WIDGET_AREA_CHART = "api.dashboards.widget.area-chart"
    API_DASHBOARDS_WIDGET_BAR_CHART_FIND_TOPN = "api.dashboards.widget.bar-chart.find-topn"
    API_DASHBOARDS_WIDGET_BAR_CHART_METRICS_ENHANCED = (
        "api.dashboards.widget.bar-chart.metrics-enhanced"
    )
    API_DASHBOARDS_WIDGET_BAR_CHART_FIND_TOPN_METRICS_ENHANCED = (
        "api.dashboards.widget.bar-chart.find-topn.metrics-enhanced"
    )
    API_DASHBOARDS_WIDGET_BAR_CHART_FIND_TOPN_METRICS_ENHANCED_PRIMARY = (
        "api.dashboards.widget.bar-chart.find-topn.metrics-enhanced.primary"
    )
    API_DASHBOARDS_WIDGET_BAR_CHART = "api.dashboards.widget.bar-chart"
    API_DASHBOARDS_WIDGET_LINE_CHART_FIND_TOPN = "api.dashboards.widget.line-chart.find-topn"
    API_DASHBOARDS_WIDGET_LINE_CHART_METRICS_ENHANCED = (
        "api.dashboards.widget.line-chart.metrics-enhanced"
    )
    API_DASHBOARDS_WIDGET_LINE_CHART_FIND_TOPN_METRICS_ENHANCED = (
        "api.dashboards.widget.line-chart.find-topn.metrics-enhanced"
    )
    API_DASHBOARDS_WIDGET_LINE_CHART_FIND_TOPN_METRICS_ENHANCED_PRIMARY = (
        "api.dashboards.widget.line-chart.find-topn.metrics-enhanced.primary"
    )
    API_DASHBOARDS_WIDGET_LINE_CHART = "api.dashboards.widget.line-chart"

    API_DISCOVER_TOTAL_COUNT_FIELD = "api.discover.total-events-field"
    API_SPANS_TOTAL_COUNT_FIELD = "api.spans.total-events-field"
    API_DISCOVER_TOTAL_SUM_TRANSACTION_DURATION_FIELD = (
        "api.discover.total-sum-transaction-duration-field"
    )
    API_DISCOVER_TOTAL_SUM_TRANSACTION_DURATION_FIELD_PRIMARY = (
        "api.discover.total-sum-transaction-duration-field.primary"
    )
    API_DISCOVER_TOTAL_SCORE_WEIGHTS_FIELD = "api.discover.total-score-weights-field"
    API_DISCOVER_DAILY_CHART = "api.discover.daily-chart"
    API_DISCOVER_DAILYTOP5_CHART_FIND_TOPN = "api.discover.dailytop5-chart.find-topn"
    API_DISCOVER_DAILYTOP5_CHART = "api.discover.dailytop5-chart"
    API_DISCOVER_DEFAULT_CHART = "api.discover.default-chart"
    API_DISCOVER_PREBUILT_CHART = "api.discover.prebuilt-chart"
    API_DISCOVER_PREVIOUS_CHART = "api.discover.previous-chart"
    API_DISCOVER_QUERY_TABLE_METRICS_ENHANCED_PRIMARY = (
        "api.discover.query-table.metrics-enhanced.primary"
    )
    API_DISCOVER_QUERY_TABLE = "api.discover.query-table"
    API_DISCOVER_TOP5_CHART_FIND_TOPN = "api.discover.top5-chart.find-topn"
    API_DISCOVER_TOP5_CHART = "api.discover.top5-chart"
    API_DISCOVER_TRANSACTIONS_LIST = "api.discover.transactions-list"
    API_EVENTS_MEASUREMENTS = "api.events.measurements"
    API_EVENTS_VITALS = "api.events.vitals"
    API_GROUP_AI_AUTOFIX = "api.group_ai_autofix"
    API_GROUP_AI_SUMMARY = "api.group_ai_summary"
    API_GROUP_EVENTS_ERROR_DIRECT_HIT = "api.group-events.error.direct-hit"
    API_GROUP_EVENTS_ERROR = "api.group-events.error"
    API_GROUP_EVENTS_PERFORMANCE_DIRECT_HIT = "api.group-events.performance.direct-hit"
    API_GROUP_EVENTS_PERFORMANCE = "api.group-events.performance"
    API_GROUP_HASHES_LEVELS_GET_LEVEL_NEW_ISSUES = "api.group_hashes_levels.get_level_new_issues"
    API_GROUP_HASHES_LEVELS_GET_HASH_FOR_PARENT_LEVEL = (
        "api.group_hashes_levels.get_hash_for_parent_level"
    )
    API_GROUP_HASHES_LEVELS_GET_LEVELS_OVERVIEW = "api.group_hashes_levels.get_levels_overview"
    API_GROUP_HASHES = "api.group-hashes"

    # ** Explore **
    API_EXPLORE_SPANS_TIMESERIES = "api.explore.spans-timeseries"
    API_EXPLORE_OURLOGS_TIMESERIES = "api.explore.ourlogs-timeseries"
    API_EXPLORE_TRACEMETRICS_TIMESERIES = "api.explore.tracemetrics-timeseries"
    API_EXPLORE_SPANS_AGGREGATES_TABLE = "api.explore.spans-aggregates-table"
    API_EXPLORE_SPANS_SAMPLES_TABLE = "api.explore.spans-samples-table"
    API_EXPLORE_SPANS_EXTRAPOLATION_META = "api.explore.spans-extrapolation-meta"
    API_EXPLORE_LOGS_TABLE = "api.explore.logs-table"
    API_EXPLORE_LOGS_TABLE_ROW = "api.explore.logs-table-row"
    API_EXPLORE_SPANS_RAW_COUNT_NORMAL = "api.explore.spans.raw-count.normal"
    API_EXPLORE_SPANS_RAW_COUNT_HIGH_ACCURACY = "api.explore.spans.raw-count.high-accuracy"
    API_EXPLORE_LOGS_RAW_COUNT_NORMAL = "api.explore.logs.raw-count.normal"
    API_EXPLORE_LOGS_RAW_COUNT_HIGH_ACCURACY = "api.explore.logs.raw-count.high-accuracy"
    API_EXPLORE_TRACEMETRICS_RAW_COUNT_NORMAL = "api.explore.tracemetrics.raw-count.normal"
    API_EXPLORE_TRACEMETRICS_RAW_COUNT_HIGH_ACCURACY = (
        "api.explore.tracemetrics.raw-count.high-accuracy"
    )
    DATA_EXPORT_TASKS_EXPLORE = "data_export.tasks.explore"

    # ** Insights **

    # General
    API_INSIGHTS_USER_GEO_SUBREGION_SELECTOR = "api.insights.user-geo-subregion-selector"

    # Resource
    API_INSIGHTS_RESOURCE_PAGE_QUERY = "api.insights.resource-page-query"
    API_INSIGHTS_RESOURCE_LANDING = "api.insights.resource.resource-landing"
    API_INSIGHTS_RESOURCE_LANDING_SERIES = "api.insights.resource.resource-landing-series"
    API_INSIGHTS_RESOURCE_SUMMARY_METRICS_RIBBON = (
        "api.insights.browser.resources.resource-summary-metrics-ribbon"
    )
    API_INSIGHTS_RESOURCE_SUMMARY_AVERAGE_SIZE_CHART = (
        "api.insights.browser.resources.resource-summary-average-size-chart"
    )
    API_INSIGHTS_RESOURCE_SUMMARY_DURATION_CHART = (
        "api.insights.browser.resources.resource-summary-duration-chart"
    )
    API_INSIGHTS_RESOURCE_SUMMARY_THROUGHPUT_CHART = (
        "api.insights.browser.resources.resource-summary-throughput-chart"
    )

    # Database
    API_INSIGHTS_DATABASE_LANDING_DURATION_CHART = "api.insights.database.landing-duration-chart"
    API_INSIGHTS_DATABASE_LANDING_THROUGHPUT_CHART = (
        "api.insights.database.landing-throughput-chart"
    )
    API_INSIGHTS_DATABASE_SUMMARY_DURATION_CHART = "api.insights.database.summary-duration-chart"
    API_INSIGHTS_DATABASE_SUMMARY_THROUGHPUT_CHART = (
        "api.insights.database.summary-throughput-chart"
    )

    # HTTP
    API_INSIGHTS_HTTP_LANDING_DOMAINS = "api.insights.http.landing-domains"
    API_INSIGHTS_HTTP_LANDING_DOMAINS_LIST = "api.insights.http.landing-domains-list"
    API_INSIGHTS_HTTP_LANDING_DURATION_CHART = "api.insights.http.landing-duration-chart"
    API_INSIGHTS_HTTP_LANDING_RESPONSE_CODE_CHART = "api.insights.http.landing-response-code-chart"
    API_INSIGHTS_HTTP_LANDING_THROUGHPUT_CHART = "api.insights.http.landing-throughput-chart"
    API_INSIGHTS_HTTP_DOMAIN_SUMMARY_DURATION_CHART = (
        "api.insights.http.domain-summary-duration-chart"
    )
    API_INSIGHTS_HTTP_DOMAIN_SUMMARY_METRICS_RIBBON = (
        "api.insights.http.domain-summary-metrics-ribbon"
    )
    API_INSIGHTS_HTTP_DOMAIN_SUMMARY_RESPONSE_CODE_CHART = (
        "api.insights.http.domain-summary-response-code-chart"
    )
    API_INSIGHTS_HTTP_DOMAIN_SUMMARY_THROUGHPUT_CHART = (
        "api.insights.http.domain-summary-throughput-chart"
    )
    API_INSIGHTS_HTTP_DOMAIN_SUMMARY_TRANSACTIONS_LIST = (
        "api.insights.http.domain-summary-transactions-list"
    )
    API_INSIGHTS_HTTP_SAMPLES_PANEL_DURATION_CHART = (
        "api.insights.http.samples-panel-duration-chart"
    )
    API_INSIGHTS_HTTP_SAMPLES_PANEL_DURATION_SAMPLES = (
        "api.insights.http.samples-panel-duration-samples"
    )
    API_INSIGHTS_HTTP_SAMPLES_PANEL_METRICS_RIBBON = (
        "api.insights.http.samples-panel-metrics-ribbon"
    )
    API_INSIGHTS_HTTP_SAMPLES_PANEL_RESPONSE_CODE_CHART = (
        "api.insights.http.samples-panel-response-code-chart"
    )
    API_INSIGHTS_HTTP_SAMPLES_PANEL_RESPONSE_CODE_SAMPLES = (
        "api.insights.http.samples-panel-response-code-samples"
    )

    # Web vitals
    API_INSIGHTS_WEB_VITAL_STATUS_LINE_CHART = "api.insights.web-vitals.vital-card-sidebar-chart"
    API_INSIGHTS_WEB_VITAL_SPANS = "api.insights.web-vitals.spans"
    API_INSIGHTS_WEB_VITAL_PROJECT = "api.insights.web-vitals.project"
    API_INSIGHTS_WEB_VITAL_TIMESERIES = "api.insights.web-vitals.timeseries"
    API_INSIGHTS_WEB_VITAL_PROJECT_SCORES = "api.insights.web-vitals.project-scores"
    API_INSIGHTS_WEB_VITAL_TIMESERIES_SCORES = "api.insights.web-vitals.timeseries-scores"
    API_INSIGHTS_WEB_VITAL_TRANSACTION = "api.insights.web-vitals.transaction"
    API_INSIGHTS_WEB_VITAL_TRANSACTIONS_SCORES = "api.insights.web-vitals.transactions-scores"
    API_INSIGHTS_WEB_VITAL_PROFILE_EXISTS = "api.insights.web-vitals.profile-exists"

    # Mobile vitals
    API_INSIGHTS_MOBILE_UI_SPAN_OPERATION_TABLE = "api.insights.mobile.ui.span-table"

    # App Starts
    API_INSIGHTS_APP_STARTS_DEVICE_CLASS_BREAKDOWN_BAR_CHART = (
        "api.insights.appstarts.device-class-breakdown-bar-chart"
    )
    API_INSIGHTS_APP_STARTS_MOBILE_STARTUP_BAR_CHART = (
        "api.insights.app-starts.mobile-startup-bar-chart"
    )

    # Screenload
    API_INSIGHTS_SCREENLOAD_SCREEN_BAR_CHART = "api.insights.screenload.screen-bar-chart"
    API_INSIGHTS_SCREENLOAD_LANDING_DURATION_CHART = "api.insights.screenload.screen-charts"

    # Caches
    API_INSIGHTS_CACHE_LANDING_CACHE_ONBOARDING = "api.insights.cache.landing-cache-onboarding"

    API_INSIGHTS_CACHE_LANDING_CACHE_HIT_MISS_CHART = (
        "api.insights.cache.landing-cache-hit-miss-chart"
    )
    API_INSIGHTS_CACHE_LANDING_CACHE_THROUGHPUT_CHART = (
        "api.insights.cache.landing-cache-throughput-chart"
    )
    API_INSIGHTS_CACHE_LANDING_CACHE_TRANSACTION_LIST = (
        "api.insights.cache.landing-cache-transaction-list"
    )
    API_INSIGHTS_CACHE_LANDING_CACHE_TRANSACTION_DURATION = (
        "api.insights.cache.landing-cache-transaction-duration"
    )

    API_INSIGHTS_CACHE_SAMPLES_CACHE_METRICS_RIBBON = (
        "api.insights.cache.samples-cache-metrics-ribbon"
    )
    API_INSIGHTS_CACHE_SAMPLES_CACHE_TRANSACTION_DURATION_CHART = (
        "api.insights.cache.samples-cache-transaction-duration-chart"
    )
    API_INSIGHTS_CACHE_SAMPLES_CACHE_TRANSACTION_DURATION = (
        "api.insights.cache.samples-cache-transaction-duration"
    )
    API_INSIGHTS_CACHE_SAMPLES_CACHE_SPAN_SAMPLES = "api.insights.cache.samples-cache-span-samples"
    API_INSIGHTS_CACHE_SAMPLES_CACHE_HIT_MISS_CHART = (
        "api.insights.cache.samples-cache-hit-miss-chart"
    )

    # Queues
    API_INSIGHTS_QUEUES_LANDING_ONBOARDING = "api.insights.queues.landing-onboarding"
    API_INSIGHTS_QUEUES_LANDING_LATENCY_CHART = "api.insights.queues.landing-latency-chart"
    API_INSIGHTS_QUEUES_LANDING_THROUGHPUT_CHART = "api.insights.queues.landing-throughput-chart"
    API_INSIGHTS_QUEUES_LANDING_DESTINATIONS_TABLE = (
        "api.insights.queues.landing-destinations-table"
    )
    API_INSIGHTS_QUEUES_SUMMARY = "api.insights.queues.summary"
    API_INSIGHTS_QUEUES_SUMMARY_LATENCY_CHART = "api.insights.queues.summary-latency-chart"
    API_INSIGHTS_QUEUES_SUMMARY_THROUGHPUT_CHART = "api.insights.queues.summary-throughput-chart"
    API_INSIGHTS_QUEUES_SUMMARY_TRANSACTIONS_TABLE = (
        "api.insights.queues.summary-transactions-table"
    )
    API_INSIGHTS_QUEUES_SAMPLES_PANEL = "api.insights.queues.samples-panel"
    API_INSIGHTS_QUEUES_SAMPLES_PANEL_TABLE = "api.insights.queues.samples-panel-table"
    API_INSIGHTS_QUEUES_SAMPLES_PANEL_DURATION_CHART = (
        "api.insights.queues.samples-panel-duration-chart"
    )

    # Transaction Summary
    API_INSIGHTS_VITAL_DETAIL = "api.insights.vital-detail"
    API_INSIGHTS_TAG_PAGE = "api.insights.tag-page"
    API_INSIGHTS_SPAN_SUMMARY_HEADER_DATA = "api.insights.span-summary-header-data"
    API_INSIGHTS_SPAN_SUMMARY_TABLE = "api.insights.span-summary-table"
    API_INSIGHTS_SPAN_SUMMARY_DURATION_CHART = "api.insights.span-summary-duration-chart"
    API_INSIGHTS_SPAN_SUMMARY_THROUGHPUT_CHART = "api.insights.span-summary-throughput-chart"
    API_INSIGHTS_SPAN_SUMMARY_TRANSACTION_THROUGHPUT_CHART = (
        "api.insights.span-summary-transaction-throughput-chart"
    )
    API_INSIGHTS_TRANSACTION_SPANS = "api.insights.transaction-spans"
    API_INSIGHTS_TRANSACTION_SUMMARY = "api.insights.transaction-summary"
    API_INSIGHTS_TRANSACTION_SUMMARY_DURATION_CHART = (
        "api.insights.transaction-summary.duration-chart"
    )
    API_INSIGHTS_TRANSACTION_SUMMARY_TRENDS_CHART = "api.insights.transaction-summary.trends-chart"
    API_INSIGHTS_TRANSACTION_SUMMARY_SIDEBAR_CHART = (
        "api.insights.transaction-summary.sidebar-chart"
    )
    API_INSIGHTS_TRANSACTION_SUMMARY_VITALS_CHART = "api.insights.transaction-summary.vitals-chart"
    API_INSIGHTS_TRANSACTION_SUMMARY_USER_MISERY_CHART = (
        "api.insights.transaction-summary.user-misery-chart"
    )
    API_INSIGHTS_TRANSACTION_EVENTS = "api.insights.transaction-events"
    API_INSIGHTS_LANDING_TABLE = "api.insights.landing-table"
    API_INSIGHTS_LANDING_TABLE_METRICS_ENHANCED_PRIMARY = (
        "api.insights.landing-table.metrics-enhanced.primary"
    )
    API_INSIGHTS_STATUS_BREAKDOWN = "api.insights.status-breakdown"
    API_INSIGHTS_DURATIONPERCENTILECHART = "api.insights.durationpercentilechart"

    # Mobile Insights
    API_INSIGHTS_MOBILE_STARTUP_TOTALS = "api.insights.mobile-startup-totals"
    API_INSIGHTS_MOBILE_STARTUP_EVENT_SAMPLES = "api.insights.mobile-startup-event-samples"
    API_INSIGHTS_MOBILE_SPARTUP_SPAN_TABLE = "api.insights.mobile-spartup-span-table"
    API_INSIGHTS_MOBILE_SCREENS_METRICS = "api.insights.mobile-screens-metrics"
    API_INSIGHTS_MOBILE_SCREENS_SPAN_METRICS = "api.insights.mobile-screens-span-metrics"
    API_INSIGHTS_MOBILE_SCREENS_SCREEN_TABLE_SPAN_METRICS = (
        "api.insights.mobile-screens-screen-table-span-metrics"
    )
    API_INSIGHTS_MOBILE_SCREEN_TOTALS = "api.insights.mobile-screen-totals"
    API_INSIGHTS_MOBILE_EVENT_SAMPLES = "api.insights.mobile-event-samples"
    API_INSIGHTS_MOBILE_SPAN_TABLE = "api.insights.mobile-span-table"
    API_INSIGHTS_MOBILE_LANDING_TABLE = "api.insights.mobile.landing-table"

    # Service Entry Spans
    API_INSIGHTS_SERVICE_ENTRY_SPANS_TABLE = "api.insights.service-entry-spans-table"
    API_INSIGHTS_SERVICE_ENTRY_SPANS_TABLE_WITH_CATEGORY = (
        "api.insights.service-entry-spans-table-with-category"
    )
    API_INSIGHTS_SERVICE_ENTRY_SPANS_TABLE_COUNT = "api.insights.service-entry-spans-table-count"

    # Trace Panel
    API_INSIGHTS_TRACE_PANEL_LEFT_TRACE_LINK = "api.insights.trace-panel-left-trace-link"
    API_INSIGHTS_TRACE_PANEL_RIGHT_TRACE_LINK = "api.insights.trace-panel-right-trace-link"
    API_INSIGHTS_TRACE_DRAWER_TRANSACTION_CACHE_METRICS = (
        "api.insights.trace.trace-drawer-transaction-cache-metrics"
    )

    # Frontend and Backend Overview
    API_INSIGHTS_FRONTEND_LANDING_TABLE = "api.insights.frontend.landing-table"
    API_INSIGHTS_BACKEND_LANDING_TABLE = "api.insights.backend.landing-table"
    API_INSIGHTS_FRONTEND_OVERVIEW_ASSETS_BY_TIME_SPENT = (
        "api.insights.frontend.overview.assets-by-time-spent"
    )
    API_INSIGHTS_FRONTEND_OVERVIEW_TIME_CONSUMING_DOMAINS = (
        "api.insights.frontend.overview.time-consuming-domains"
    )
    API_INSIGHTS_FRONTEND_OVERVIEW_TRANSACTION_THROUGHPUT = (
        "api.insights.frontend.overview.transaction-throughput"
    )
    API_INSIGHTS_FRONTEND_OVERVIEW_TRANSACTION_DURATION = (
        "api.insights.frontend.overview.transaction-duration"
    )
    API_INSIGHTS_BACKEND_OVERVIEW_REQUESTS_CHART = "api.insights.backend.overview.requests-chart"
    API_INSIGHTS_BACKEND_OVERVIEW_DURATION_CHART = "api.insights.backend.overview.duration-chart"
    API_INSIGHTS_BACKEND_OVERVIEW_JOBS_CHART = "api.insights.backend.overview.jobs-chart"
    API_INSIGHTS_BACKEND_OVERVIEW_QUERIES_CHART = "api.insights.backend.overview.queries-chart"
    API_INSIGHTS_BACKEND_OVERVIEW_CACHE_CHART = "api.insights.backend.overview.cache-chart"
    API_INSIGHTS_BACKEND_OVERVIEW_WEB_VITALS_CHART = (
        "api.insights.backend.overview.web-vitals-chart"
    )
    API_INSIGHTS_BACKEND_OVERVIEW_PATHS_TABLE = "api.insights.backend.overview.paths-table"
    API_INSIGHTS_BACKEND_OVERVIEW_SLOW_SSR_CHART = "api.insights.backend.overview.slow-ssr-chart"
    API_INSIGHTS_BACKEND_OVERVIEW_CLIENT_TABLE = "api.insights.backend.overview.client-table"
    API_INSIGHTS_BACKEND_OVERVIEW_API_TABLE = "api.insights.backend.overview.api-table"
    API_INSIGHTS_NEXTJS_OVERVIEW_API_TREE = "api.insights.nextjs.overview.api-tree"

    # App Starts
    API_INSIGHTS_APPSTARTS_START_DURATION_WIDGET = "api.insights.appstarts.start-duration-widget"

    # Span Operations and Descriptions
    API_INSIGHTS_GET_SPAN_ACTIONS = "api.insights.get-span-actions"
    API_INSIGHTS_GET_SPAN_DOMAINS = "api.insights.get-span-domains"
    API_INSIGHTS_USE_SPAN_LIST = "api.insights.use-span-list"
    API_INSIGHTS_SPAN_DESCRIPTION = "api.insights.span-description"
    API_INSIGHTS_SPAN_TRANSACTION_METRICS = "api.insights.span-transaction-metrics"
    API_INSIGHTS_SPAN_SUMMARY_PAGE_METRICS = "api.insights.span-summary-page-metrics"
    API_INSIGHTS_GET_SPAN_OPERATIONS = "api.insights.get-span-operations"
    API_INSIGHTS_DATABASE_SYSTEM_SELECTOR = "api.insights.database-system-selector"
    API_INSIGHTS_SPAN_SUMMARY_PANEL_SAMPLES_TABLE_AVG = (
        "api.insights.span-summary-panel-samples-table-avg"
    )
    API_INSIGHTS_BROWSER_RESOURCES_PAGE_SELECTOR = "api.insights.browser.resources.page-selector"

    # AI Agents
    API_INSIGHTS_AGENTS_MODELS_TABLE = "api.insights.agent-monitoring.models-table"
    API_INSIGHTS_AGENTS_TOOLS_TABLE = "api.insights.agent-monitoring.tools-table"
    API_INSIGHTS_AGENTS_TRACE_DRAWER = "api.insights.agent-monitoring.trace-drawer"
    API_INSIGHTS_AGENTS_TRACES_TABLE = "api.insights.agent-monitoring.traces-table"
    API_INSIGHTS_AGENTS_TOKEN_USAGE_WIDGET = "api.insights.agent-monitoring.token-usage-widget"
    API_INSIGHTS_AGENTS_TOKEN_COST_WIDGET = "api.insights.agent-monitoring.token-cost-widget"
    API_INSIGHTS_AGENTS_TOKEN_TYPES_WIDGET = "api.insights.agent-monitoring.token-types-widget"
    API_INSIGHTS_AGENTS_TOOL_CALLS_WIDGET = "api.insights.agent-monitoring.tool-calls-widget"
    API_INSIGHTS_AGENTS_TOOL_ERRORS_WIDGET = "api.insights.agent-monitoring.tool-errors-widget"
    API_INSIGHTS_AGENTS_LLM_CALLS_WIDGET = "api.insights.agent-monitoring.llm-calls-widget"
    API_INSIGHTS_AGENTS_AGENT_RUNS_WIDGET = "api.insights.agent-monitoring.agent-runs-widget"
    API_INSIGHTS_AGENTS_AGENT_DURATION_WIDGET = (
        "api.insights.agent-monitoring.agent-duration-widget"
    )
    API_INSIGHTS_AGENTS_ONBOARDING = "api.insights.agent-monitoring.onboarding"

    # MCP (Model Context Protocol)
    API_INSIGHTS_MCP_PROMPT_DURATION_WIDGET = "api.insights.mcp.prompt-duration-widget"
    API_INSIGHTS_MCP_PROMPT_ERROR_RATE_WIDGET = "api.insights.mcp.prompt-error-rate-widget"
    API_INSIGHTS_MCP_PROMPT_TABLE = "api.insights.mcp.prompt-table"
    API_INSIGHTS_MCP_PROMPT_TRAFFIC_WIDGET = "api.insights.mcp.prompt-traffic-widget"
    API_INSIGHTS_MCP_RESOURCE_DURATION_WIDGET = "api.insights.mcp.resource-duration-widget"
    API_INSIGHTS_MCP_RESOURCE_ERROR_RATE_WIDGET = "api.insights.mcp.resource-error-rate-widget"
    API_INSIGHTS_MCP_RESOURCE_TABLE = "api.insights.mcp.resource-table"
    API_INSIGHTS_MCP_RESOURCE_TRAFFIC_WIDGET = "api.insights.mcp.resource-traffic-widget"
    API_INSIGHTS_MCP_TOOL_DURATION_WIDGET = "api.insights.mcp.tool-duration-widget"
    API_INSIGHTS_MCP_TOOL_ERROR_RATE_WIDGET = "api.insights.mcp.tool-error-rate-widget"
    API_INSIGHTS_MCP_TOOL_TABLE = "api.insights.mcp.tool-table"
    API_INSIGHTS_MCP_TOOL_TRAFFIC_WIDGET = "api.insights.mcp.tool-traffic-widget"
    API_INSIGHTS_MCP_TRAFFIC_BY_CLIENT_WIDGET = "api.insights.mcp.traffic-by-client-widget"
    API_INSIGHTS_MCP_TRAFFIC_WIDGET = "api.insights.mcp.traffic-widget"
    API_INSIGHTS_MCP_TRANSPORT_WIDGET = "api.insights.mcp.transport-widget"

    # Misc
    API_INSIGHTS_ORG_EVENT_AVERAGE_SPAN = "api.insights.org-event-average-span"

    API_ISSUES_ISSUE_EVENTS = "api.issues.issue_events"
    API_ISSUES_RELATED_ISSUES = "api.issues.related_issues"
    API_METRICS_TOTALS = "api.metrics.totals"
    API_METRICS_TOTALS_INITIAL_QUERY = "api.metrics.totals.initial_query"
    API_METRICS_TOTALS_SECOND_QUERY = "api.metrics.totals.second_query"
    API_METRICS_SERIES_SECOND_QUERY = "api.metrics.series.second_query"

    API_ORGANIZATION_TRACE_ITEM_DETAILS = "api.organization-trace-item-details"
    API_ORGANIZATION_EVENT_STATS_FIND_TOPN = "api.organization-event-stats.find-topn"
    API_ORGANIZATION_EVENT_STATS_METRICS_ENHANCED = "api.organization-event-stats.metrics-enhanced"
    API_ORGANIZATION_EVENT_STATS = "api.organization-event-stats"
    API_ORGANIZATION_EVENTS_FACETS_PERFORMANCE_HISTOGRAM_TOP_TAGS = (
        "api.organization-events-facets-performance-histogram.top_tags"
    )
    API_ORGANIZATION_EVENTS_FACETS_PERFORMANCE_HISTOGRAM = (
        "api.organization-events-facets-performance-histogram"
    )
    API_ORGANIZATION_EVENTS_FACETS_PERFORMANCE_TOP_TAGS_ALL_TRANSACTIONS = (
        "api.organization-events-facets-performance.top-tags.all_transactions"
    )
    API_ORGANIZATION_EVENTS_FACETS_PERFORMANCE_TOP_TAGS_TAG_VALUES = (
        "api.organization-events-facets-performance.top-tags.tag_values"
    )
    API_ORGANIZATION_EVENTS_FACETS_TOP_TAGS = "api.organization-events-facets.top-tags"
    API_ORGANIZATION_EVENTS_HISTOGRAM_MIN_MAX_METRICS_ENHANCED_PRIMARY = (
        "api.organization-events-histogram-min-max.metrics-enhanced.primary"
    )
    API_ORGANIZATION_EVENTS_HISTOGRAM_MIN_MAX = "api.organization-events-histogram-min-max"
    API_ORGANIZATION_EVENTS_HISTOGRAM_PRIMARY = "api.organization-events-histogram.primary"
    API_ORGANIZATION_EVENTS_HISTOGRAM = "api.organization-events-histogram"
    API_ORGANIZATION_EVENTS_META = "api.organization-events-meta"
    API_ORGANIZATION_EVENTS_METRICS_COMPATIBILITY_COMPATIBLE_METRICS_ENHANCED_PRIMARY = (
        "api.organization-events-metrics-compatibility.compatible.metrics-enhanced.primary"
    )
    API_ORGANIZATION_EVENTS_METRICS_COMPATIBILITY_SUM_METRICS_METRICS_ENHANCED_PRIMARY = (
        "api.organization-events-metrics-compatibility.sum_metrics.metrics-enhanced.primary"
    )
    API_ORGANIZATION_EVENTS_METRICS_ENHANCED = "api.organization-events.metrics-enhanced"
    API_ORGANIZATION_EVENTS_METRICS_ENHANCED_PRIMARY = (
        "api.organization-events.metrics-enhanced.primary"
    )
    API_ORGANIZATION_EVENTS_METRICS_ENHANCED_SECONDARY = (
        "api.organization-events.metrics-enhanced.secondary"
    )
    API_ORGANIZATION_EVENTS_SPAN_OPS = "api.organization-events-span-ops"
    API_ORGANIZATION_EVENTS_SPANS_HISTOGRAM = "api.organization-events-spans-histogram"
    API_ORGANIZATION_EVENTS_SPANS_PERFORMANCE_EXAMPLES = (
        "api.organization-events-spans-performance-examples"
    )
    API_ORGANIZATION_SPANS_AGGREGATION = "api.organization-spans-aggregation"
    API_ORGANIZATION_EVENTS_SPANS_PERFORMANCE_STATS = (
        "api.organization-events-spans-performance-stats"
    )
    API_ORGANIZATION_EVENTS_SPANS_PERFORMANCE_SUSPECTS = (
        "api.organization-events-spans-performance-suspects"
    )
    API_ORGANIZATION_EVENTS_V2 = "api.organization-events-v2"
    API_ORGANIZATION_EVENTS = "api.organization-events"
    API_ORGANIZATION_METRICS_DATA = "api.organization.metrics-data"
    API_ORGANIZATION_METRICS_ESTIMATION_STATS = "api.organization-metrics-estimation-stats"
    API_ORGANIZATION_METRICS_METADATA_FETCH_SPANS = "api.organization.metrics-metadata.fetch-spans"
    API_ORGANIZATION_METRICS_QUERY = "api.organization.metrics-query"
    API_ORGANIZATION_METRICS_EAP_QUERY = "api.organization.metrics-eap-query"
    API_ORGANIZATION_ISSUES_COUNT = "api.organization-issues-count"
    API_ORGANIZATION_ISSUE_REPLAY_COUNT = "api.organization-issue-replay-count"
    API_ORGANIZATION_SDK_UPDATES = "api.organization-sdk-updates"
    API_ORGANIZATION_SPANS_HISTOGRAM_MIN_MAX = "api.organization-spans-histogram-min-max"
    API_ORGANIZATION_VITALS_PER_PROJECT = "api.organization-vitals-per-project"
    API_ORGANIZATION_VITALS = "api.organization-vitals"
    API_AI_CONVERSATIONS = "api.ai-conversations"
    API_AI_CONVERSATIONS_COMPLETE = "api.ai-conversations.complete"
    API_AI_CONVERSATIONS_ENRICHMENT = "api.ai-conversations.enrichment"
    API_AI_CONVERSATIONS_FIRST_LAST_IO = "api.ai-conversations.first-last-io"
    API_AI_PIPELINES_VIEW = "api.ai-pipelines.view"
    API_AI_PIPELINES_DETAILS_VIEW = "api.ai-pipelines.details.view"
    API_PROFILING_ONBOARDING = "profiling-onboarding"
    API_PROFILING_LANDING_CHART = "api.profiling.landing-chart"
    API_PROFILING_LANDING_TABLE = "api.profiling.landing-table"
    API_PROFILING_LANDING_FUNCTIONS_CARD = "api.profiling.landing-functions-card"
    API_PROFILING_PROFILE_HAS_CHUNKS = "api.profiling.profile-has-chunks"
    API_PROFILING_PROFILE_SUMMARY_CHART = "api.profiling.profile-summary-chart"
    API_PROFILING_PROFILE_SUMMARY_TOTALS = "api.profiling.profile-summary-totals"
    API_PROFILING_PROFILE_SUMMARY_TABLE = "api.profiling.profile-summary-table"
    API_PROFILING_PROFILE_SUMMARY_FUNCTIONS_TABLE = "api.profiling.profile-summary-functions-table"
    API_PROFILING_PROFILE_FLAMEGRAPH_TRANSACTION_CANDIDATES = (
        "api.profiling.profile-flamegraph-transaction-candidates"
    )
    API_PROFILING_PROFILE_FLAMEGRAPH_CHUNK_CANDIDATES = (
        "api.profiling.profile-flamegraph-chunk-candidates"
    )
    API_PROFILING_PROFILE_FLAMEGRAPH_PROFILE_CANDIDATES = (
        "api.profiling.profile-flamegraph-profile-candidates"
    )
    API_PROFILING_FLAMEGRAPH_SPANS_WITH_GROUP = "api.profiling.flamegraph-spans-with-group"
    API_PROFILING_FLAMEGRAPH_CHUNKS_FROM_SPANS = "api.profiling.flamegraph-chunks-with-spans"
    API_PROFILING_FUNCTION_SCOPED_FLAMEGRAPH = "api.profiling.function-scoped-flamegraph"
    API_PROFILING_TRANSACTION_HOVERCARD_FUNCTIONS = "api.profiling.transaction-hovercard.functions"
    API_PROFILING_TRANSACTION_HOVERCARD_LATEST = "api.profiling.transaction-hovercard.latest"
    API_PROFILING_TRANSACTION_HOVERCARD_SLOWEST = "api.profiling.transaction-hovercard.slowest"
    API_PROFILING_SUSPECT_FUNCTIONS_LIST = "api.profiling.suspect-functions.list"
    API_PROFILING_SUSPECT_FUNCTIONS_TOTALS = "api.profiling.suspect-functions.totals"
    API_PROFILING_SUSPECT_FUNCTIONS_TRANSACTIONS = "api.profiling.suspect-functions.transactions"
    API_PROFILING_FUNCTION_TRENDS_TOP_EVENTS = "api.profiling.function-trends.top-events"
    API_PROFILING_FUNCTION_TRENDS_STATS = "api.profiling.function-trends.stats"
    API_PROFILING_FUNCTIONS_STATISTICAL_DETECTOR = "api.profiling.functions.statistical-detector"
    API_PROFILING_FUNCTIONS_STATISTICAL_DETECTOR_STATS = (
        "api.profiling.functions.statistical-detector.stats"
    )
    API_PROFILING_FUNCTIONS_STATISTICAL_DETECTOR_EXAMPLE = (
        "api.profiling.functions.statistical-detector.example"
    )
    API_PROFILING_FUNCTIONS_STATISTICAL_DETECTOR_CHUNKS = (
        "api.profiling.functions.statistical-detector.chunks"
    )
    API_PROFILING_FUNCTIONS_REGRESSION_EXAMPLES = "api.profiling.functions.regression.examples"
    API_PROFILING_FUNCTIONS_REGRESSION_LIST = "api.profiling.functions.regression.list"
    API_PROFILING_FUNCTIONS_REGRESSION_STATS = "api.profiling.functions.regression.stats"
    API_PROFILING_FUNCTIONS_REGRESSION_TRANSACTIONS = (
        "api.profiling.functions.regression.transactions"
    )
    API_PROFILING_FUNCTIONS_REGRESSION_TRANSACTION_STATS = (
        "api.profiling.functions.regression.transaction-stats"
    )
    API_PROFILING_CONTINUOUS_PROFILING_FLAMECHART = "api.profiling.continuous-profiling.flamechart"
    API_PROJECT_EVENTS = "api.project-events"
    API_RELEASES_RELEASE_DETAILS_CHART = "api.releases.release-details-chart"
    API_REPLAY_DETAILS_PAGE = "api.replay.details-page"
    API_REPLAY_SUMMARIZE_BREADCRUMBS = "api.replay.summarize-breadcrumbs"
    API_TRACE_EXPLORER_METRICS_SPANS_LIST = "api.trace-explorer.metrics-spans-list"
    API_TRACE_EXPLORER_SPANS_LIST = "api.trace-explorer.spans-list"
    API_TRACE_EXPLORER_SPANS_LIST_SORTED = "api.trace-explorer.spans-list-sorted"
    API_TRACE_EXPLORER_STATS = "api.trace-explorer.stats"
    API_TRACE_EXPLORER_TRACES_BREAKDOWNS = "api.trace-explorer.traces-breakdowns"
    API_TRACE_EXPLORER_TRACES_META = "api.trace-explorer.traces-meta"
    API_TRACE_EXPLORER_TRACES_ERRORS = "api.trace-explorer.traces-errors"
    API_TRACE_EXPLORER_TRACES_OCCURRENCES = "api.trace-explorer.traces-occurrences"
    API_TRACE_EXPLORER_TRACE_SPANS_LIST = "api.trace-explorer.trace-spans-list"
    API_TRACE_EXPLORER_TRACE_SPANS_CANDIDATES_FLAMEGRAPH = (
        "api.trace-explorer.trace-spans-flamegraph"
    )
    API_EXPLORE_COMPARE_SERIES = "api.explore.compare-series"
    API_EXPLORE_COMPARE_TABLE = "api.explore.compare-table"
    API_EXPLORE_MULTI_QUERY_SPANS_TABLE = "api.explore.multi-query-spans-table"
    API_LOGS_TAG_KEYS_RPC = "api.logs.tags-keys.rpc"
    API_LOGS_TAG_VALUES_RPC = "api.logs.tags-values.rpc"
    API_LOGS_TAB_VIEW = "api.logs-tab.view"
    API_SPANS_TAG_KEYS = "api.spans.tags-keys"
    API_SPANS_TAG_KEYS_RPC = "api.spans.tags-keys.rpc"
    API_SPANS_TAG_VALUES = "api.spans.tags-values"
    API_SPANS_FREQUENCY_STATS_RPC = "api.spans.fields-stats.rpc"
    API_SPANS_TAG_VALUES_RPC = "api.spans.tags-values.rpc"
    API_SPANS_TRACE_VIEW = "api.spans.trace-view"
    API_TRACE_METRICS_TAG_KEYS_RPC = "api.tracemetrics.tags-keys.rpc"
    API_TRACE_METRICS_TAG_VALUES_RPC = "api.tracemetrics.tags-values.rpc"

    API_SPAN_SAMPLE_GET_BOUNDS = "api.spans.sample-get-bounds"
    API_SPAN_SAMPLE_GET_SPAN_IDS = "api.spans.sample-get-span-ids"
    API_SPAN_SAMPLE_GET_SPAN_DATA = "api.spans.sample-get-span-data"
    API_SERIALIZER_PROJECTS_GET_STATS = "api.serializer.projects.get_stats"
    API_SERIALIZER_CHECKINS_TRACE_IDS = "api.serializer.checkins.trace-ids"
    API_TRACE_VIEW_ERRORS_VIEW = "api.trace-view.errors-view"
    API_TRACE_VIEW_GET_TIMESTAMP_PROJECTS = "api.trace-view.get-timestamp-projects"
    API_TRACE_VIEW_GET_EVENTS = "api.trace-view.get-events"
    API_TRACE_VIEW_GET_META = "api.trace-view.get-meta"
    API_TRACE_VIEW_SPAN_META = "api.trace-view.spans-meta"
    API_TRACE_VIEW_SPAN_OP_META = "api.trace-view.spans-op-count"
    API_TRACE_VIEW_TRANSACTION_CHILDREN = "api.trace-view.transaction-children"
    API_TRACE_VIEW_LOGS_META = "api.trace-view.logs-meta"
    API_TRACE_VIEW_LOGS = "api.trace-view.logs"
    API_TRACE_VIEW_HOVER_CARD = "api.trace-view.hover-card"
    API_TRACE_VIEW_SPAN_DETAIL = "api.trace-view.span-detail"
    API_TRACE_VIEW_COUNT_PERFORMANCE_ISSUES = "api.trace-view.count-performance-issues"
    API_TRACE_VIEW_GET_PARENTS = "api.trace-view.get-parents"
    API_TRACE_VIEW_GET_OCCURRENCE_IDS = "api.trace-view.get-occurrence-ids"
    API_TRACE_VIEW_LINKED_TRACES = "api.trace-view.linked-traces"
    API_TRENDS_GET_EVENT_STATS = "api.trends.get-event-stats"
    API_TRENDS_GET_EVENT_STATS_V2_TOP_EVENTS = "api.trends.get-event-statsv2.top-events"
    API_TRENDS_GET_EVENT_STATS_V2_TOP_EVENTS_PRIMARY = (
        "api.trends.get-event-statsv2.top-events.metrics-enhanced.primary"
    )
    API_TRENDS_GET_EVENT_STATS_V2_TOP_EVENTS_METRICS_ENHANCED = (
        "api.trends.get-event-statsv2.top-events.metrics-enhanced"
    )
    API_TRENDS_GET_EVENT_STATS_V2_TIMESERIES = "api.trends.get-event-statsv2.timeseries"
    API_TRENDS_GET_EVENT_STATS_V2_TIMESERIES_METRICS_ENHANCED = (
        "api.trends.get-event-statsv2.timeseries.metrics-enhanced"
    )
    API_TRENDS_GET_PERCENTAGE_CHANGE = "api.trends.get-percentage-change"
    API_UPTIME_CHECKS_GRID = "api.uptime-checks-grid"
    API_VROOM = "api.vroom"
    BACKFILL_PERF_ISSUE_EVENTS = "migration.backfill_perf_issue_events_issue_platform"
    DATA_EXPORT_TASKS_DISCOVER = "data_export.tasks.discover"
    DELETIONS_GROUP = "deletions.group"
    DISCOVER = "discover"
    DISCOVER_SLACK_UNFURL = "discover.slack.unfurl"
    DYNAMIC_SAMPLING_DISTRIBUTION_FETCH_PROJECT_BREAKDOWN = (
        "dynamic-sampling.distribution.fetch-project-breakdown"
    )
    DYNAMIC_SAMPLING_DISTRIBUTION_FETCH_PROJECT_SDK_VERSIONS_INFO = (
        "dynamic-sampling.distribution.fetch-project-sdk-versions-info"
    )
    DYNAMIC_SAMPLING_DISTRIBUTION_FETCH_PROJECT_STATS = (
        "dynamic-sampling.distribution.fetch-project-stats"
    )
    DYNAMIC_SAMPLING_DISTRIBUTION_FETCH_TRANSACTIONS_COUNT = (
        "dynamic-sampling.distribution.fetch-transactions-count"
    )
    DYNAMIC_SAMPLING_DISTRIBUTION_FETCH_TRANSACTIONS = (
        "dynamic-sampling.distribution.fetch-transactions"
    )
    DYNAMIC_SAMPLING_DISTRIBUTION_GET_MOST_RECENT_DAY_WITH_TRANSACTIONS = (
        "dynamic-sampling.distribution.get-most-recent-day-with-transactions"
    )
    DYNAMIC_SAMPLING_COUNTERS_GET_ORG_TRANSACTION_VOLUMES = (
        "dynamic_sampling.counters.get_org_transaction_volumes"
    )
    DYNAMIC_SAMPLING_DISTRIBUTION_FETCH_ORGS_WITH_COUNT_PER_ROOT = (
        "dynamic_sampling.distribution.fetch_orgs_with_count_per_root_total_volumes"
    )
    DYNAMIC_SAMPLING_DISTRIBUTION_FETCH_PROJECTS_WITH_COUNT_PER_ROOT = (
        "dynamic_sampling.distribution.fetch_projects_with_count_per_root_total_volumes"
    )
    DYNAMIC_SAMPLING_COUNTERS_FETCH_PROJECTS_WITH_COUNT_PER_TRANSACTION = (
        "dynamic_sampling.counters.fetch_projects_with_count_per_transaction_volumes"
    )
    DYNAMIC_SAMPLING_COUNTERS_GET_ACTIVE_ORGS = "dynamic_sampling.counters.get_active_orgs"
    DYNAMIC_SAMPLING_COUNTERS_FETCH_PROJECTS_WITH_TRANSACTION_TOTALS = (
        "dynamic_sampling.counters.fetch_projects_with_transaction_totals"
    )
    DYNAMIC_SAMPLING_COUNTERS_FETCH_ACTIVE_ORGS = "dynamic_sampling.counters.fetch_active_orgs"
    DYNAMIC_SAMPLING_TASKS_CUSTOM_RULE_NOTIFICATIONS = (
        "dynamic_sampling.tasks.custom_rule_notifications"
    )
    DYNAMIC_SAMPLING_SETTINGS_GET_SPAN_COUNTS = "dynamic_sampling.settings.get_project_span_counts"
    ESCALATING_GROUPS = "sentry.issues.escalating"
    EVENTSTORE_GET_EVENT_BY_ID_NODESTORE = "eventstore.backend.get_event_by_id_nodestore"
    EVENTSTORE_GET_EVENTS = "eventstore.get_events"
    EVENTSTORE_GET_NEXT_OR_PREV_EVENT_ID = "eventstore.get_next_or_prev_event_id"
    EVENTSTORE_GET_UNFETCHED_EVENTS = "eventstore.get_unfetched_events"
    EVENTSTORE_GET_UNFETCHED_TRANSACTIONS = "eventstore.get_unfetched_transactions"
    EXPORT_EVENTS = "export-events"
    FETCH_EVENTS_FOR_DELETION = "fetch_events_for_deletion"
    GETSENTRY_API_PENDO_DETAILS = "getsentry.api.pendo-details"
    GETSENTRY_PROMOTION_MOBILE_PERFORMANCE_ADOPTION_CHECK_CONDITIONS = (
        "getsentry.promotion.mobile_performance_adoption.check_conditions"
    )
    GETSENTRY_PROMOTION_MOBILE_PERFORMANCE_ADOPTION_CHECK_ELIGIBLE = (
        "getsentry.promotion.mobile_performance_adoption.check_eligible"
    )
    GETSENTRY_EXPORT_SPANS_GET_TRACES = "getsentry.export.spans.get_traces"
    GETSENTRY_EXPORT_SPANS_GET_ITEM_DETAILS = "getsentry.export.spans.get_item_details"
    GITHUB_PR_COMMENT_BOT = "tasks.github_comment"
    GITLAB_PR_COMMENT_BOT = "tasks.gitlab_comment"
    GROUP_FILTER_BY_EVENT_ID = "group.filter_by_event_id"
    GROUP_GET_HELPFUL = "Group.get_helpful"
    GROUP_GET_LATEST = "Group.get_latest"
    GROUP_UNHANDLED_FLAG = "group.unhandled-flag"
    GROUPING_RECORDS_BACKFILL_REFERRER = "getsentry.tasks.backfill_grouping_records"
    INCIDENTS_GET_INCIDENT_AGGREGATES_PRIMARY = "incidents.get_incident_aggregates.primary"
    INCIDENTS_GET_INCIDENT_AGGREGATES = "incidents.get_incident_aggregates"
    IS_ESCALATING_GROUP = "sentry.issues.escalating.is_escalating"
    ISSUE_DETAILS_STREAMLINE_GRAPH = "issue_details.streamline_graph"
    ISSUE_DETAILS_STREAMLINE_LIST = "issue_details.streamline_list"
    ISSUES_SUSPECT_FLAGS_QUERY_BASELINE_SET = "issues.suspect_flags.query_baseline_set"
    ISSUES_SUSPECT_FLAGS_QUERY_SELECTION_SET = "issues.suspect_flags.query_selection_set"
    ISSUES_SUSPECT_FLAGS_QUERY_ERROR_COUNTS = "issues.suspect_flags.query_error_counts"
    ISSUES_SUSPECT_TAGS_QUERY_BASELINE_SET = "issues.suspect_tags.query_baseline_set"
    ISSUES_SUSPECT_TAGS_QUERY_SELECTION_SET = "issues.suspect_tags.query_selection_set"
    ISSUES_SUSPECT_TAGS_QUERY_ERROR_COUNTS = "issues.suspect_tags.query_error_counts"

    INSIGHTS_MOBILE_HAS_TTFDCONFIGURED = "insights.mobile.hasTTFDConfigured"
    INSIGHTS_TIME_SPENT_TOTAL_TIME = "insights.time_spent.total_time"

    METRIC_EXTRACTION_CARDINALITY_CHECK = "metric_extraction.cardinality_check"
    OUTCOMES_TIMESERIES = "outcomes.timeseries"
    OUTCOMES_TOTALS = "outcomes.totals"
    PREVIEW_GET_EVENTS = "preview.get_events"
    PREVIEW_GET_FREQUENCY_BUCKETS = "preview.get_frequency_buckets"
    PREVIEW_GET_TOP_GROUPS = "preview.get_top_groups"
    RELEASE_HEALTH_METRICS_CHECK_HAS_HEALTH_DATA = "release_health.metrics.check_has_health_data"
    RELEASE_HEALTH_METRICS_CHECK_RELEASES_HAVE_HEALTH_DATA = (
        "release_health.metrics.check_releases_have_health_data"
    )
    RELEASE_HEALTH_METRICS_CRASH_FREE_BREAKDOWN_SESSION = (
        "release_health.metrics.crash-free-breakdown.session"
    )
    RELEASE_HEALTH_METRICS_CRASH_FREE_BREAKDOWN_USERS = (
        "release_health.metrics.crash-free-breakdown.users"
    )
    RELEASE_HEALTH_METRICS_GET_ABNORMAL_AND_CRASHED_SESSIONS_FOR_OVERVIEW = (
        "release_health.metrics.get_abnormal_and_crashed_sessions_for_overview"
    )
    RELEASE_HEALTH_METRICS_GET_CHANGED_PROJECT_RELEASE_MODEL_ADOPTIONS = (
        "release_health.metrics.get_changed_project_release_model_adoptions"
    )
    RELEASE_HEALTH_METRICS_GET_CRASH_FREE_DATA = "release_health.metrics.get_crash_free_data"
    RELEASE_HEALTH_METRICS_GET_ERRORED_SESSIONS_FOR_OVERVIEW = (
        "release_health.metrics.get_errored_sessions_for_overview"
    )
    RELEASE_HEALTH_METRICS_GET_HEALTH_STATS_FOR_OVERVIEW = (
        "release_health.metrics.get_health_stats_for_overview"
    )
    RELEASE_HEALTH_METRICS_GET_OLDEST_HEALTH_DATA_FOR_RELEASES = (
        "release_health.metrics.get_oldest_health_data_for_releases"
    )
    RELEASE_HEALTH_METRICS_GET_PROJECT_RELEASE_STATS_DURATIONS = (
        "release_health.metrics.get_project_release_stats_durations"
    )
    RELEASE_HEALTH_METRICS_GET_PROJECT_RELEASE_STATS_SESSIONS_ERROR_SERIES = (
        "release_health.metrics.get_project_release_stats_sessions_error_series"
    )
    RELEASE_HEALTH_METRICS_GET_PROJECT_RELEASE_STATS_SESSIONS_SERIES = (
        "release_health.metrics.get_project_release_stats_sessions_series"
    )
    RELEASE_HEALTH_METRICS_GET_PROJECT_RELEASE_STATS_USER_TOTALS = (
        "release_health.metrics.get_project_release_stats_user_totals"
    )
    RELEASE_HEALTH_METRICS_GET_PROJECT_RELEASES_BY_STABILITY = (
        "release_health.metrics.get_project_releases_by_stability"
    )
    RELEASE_HEALTH_METRICS_GET_PROJECT_RELEASES_COUNT = (
        "release_health.metrics.get_project_releases_count"
    )
    RELEASE_HEALTH_METRICS_GET_PROJECT_SESSIONS_COUNT = (
        "release_health.metrics.get_project_sessions_count"
    )
    RELEASE_HEALTH_METRICS_GET_RELEASE_ADOPTION_RELEASES_SESSIONS = (
        "release_health.metrics.get_release_adoption.releases_sessions"
    )
    RELEASE_HEALTH_METRICS_GET_RELEASE_ADOPTION_RELEASES_USERS = (
        "release_health.metrics.get_release_adoption.releases_users"
    )
    RELEASE_HEALTH_METRICS_GET_RELEASE_ADOPTION_TOTAL_SESSIONS = (
        "release_health.metrics.get_release_adoption.total_sessions"
    )
    RELEASE_HEALTH_METRICS_GET_RELEASE_ADOPTION_TOTAL_USERS = (
        "release_health.metrics.get_release_adoption.total_users"
    )
    RELEASE_HEALTH_METRICS_GET_RELEASE_SESSIONS_TIME_BOUNDS_INIT_SESSIONS = (
        "release_health.metrics.get_release_sessions_time_bounds.init_sessions"
    )
    RELEASE_HEALTH_METRICS_GET_RELEASE_SESSIONS_TIME_BOUNDS_TERMINAL_SESSIONS = (
        "release_health.metrics.get_release_sessions_time_bounds.terminal_sessions"
    )
    RELEASE_HEALTH_METRICS_GET_SESSION_DURATION_DATA_FOR_OVERVIEW = (
        "release_health.metrics.get_session_duration_data_for_overview"
    )
    RELEASE_HEALTH_METRICS_GET_USERS_AND_CRASHED_USERS_FOR_OVERVIEW = (
        "release_health.metrics.get_users_and_crashed_users_for_overview"
    )
    RELEASE_MONITOR_FETCH_PROJECT_RELEASE_HEALTH_TOTALS = (
        "release_monitor.fetch_project_release_health_totals"
    )
    RELEASE_MONITOR_FETCH_PROJECTS_WITH_RECENT_SESSIONS = (
        "release_monitor.fetch_projects_with_recent_sessions"
    )
    REPLAYS_QUERY_QUERY_REPLAYS_COUNT = "replays.query.query_replays_count"
    REPLAYS_QUERY_QUERY_REPLAYS_DATASET = "replays.query.query_replays_dataset"
    REPLAYS_QUERY_QUERY_REPLAYS_DATASET_SUBQUERY = "replays.query.query_replays_dataset_subquery"
    REPLAYS_QUERY_BROWSE_SIMPLE_AGGREGATION = "replays.query.browse_simple_aggregation"
    REPLAYS_FILE_REFERRER = "replays.query.download_replay_segments"
    REPLAYS_SCRIPTS_DELETE_REPLAYS = "replays.scripts.delete_replays"
    FEEDBACKS_LABEL_QUERY = "feedbacks.label_query"
    EU_DATA_EXPORT = "sentry.internal.eu-compliance-data-export"
    REPORTS_KEY_ERRORS = "reports.key_errors"
    REPORTS_KEY_PERFORMANCE_ISSUES = "reports.key_performance_issues"
    REPORTS_KEY_TRANSACTIONS_P95 = "reports.key_transactions.p95"
    REPORTS_KEY_TRANSACTIONS = "reports.key_transactions"
    REPORTS_OUTCOME_SERIES = "reports.outcome_series"
    REPORTS_OUTCOMES = "reports.outcomes"
    DAILY_SUMMARY_KEY_ERRORS = "daily_summary.key_errors"
    DAILY_SUMMARY_KEY_PERFORMANCE_ISSUES = "daily_summary.key_performance_issues"
    DAILY_SUMMARY_KEY_TRANSACTIONS_P95 = "daily_summary.key_transactions.p95"
    DAILY_SUMMARY_KEY_TRANSACTIONS = "daily_summary.key_transactions"
    DAILY_SUMMARY_OUTCOME_SERIES = "daily_summary.outcome_series"
    DAILY_SUMMARY_OUTCOMES = "daily_summary.outcomes"
    REPROCESSING2_REPROCESS_GROUP = "reprocessing2.reprocess_group"
    REPROCESSING2_START_GROUP_REPROCESSING = "reprocessing2.start_group_reprocessing"
    SEARCH_SAMPLE = "search_sample"
    SEARCH = "search"
    SEARCH_GROUP_INDEX = "search.group_index"
    SEARCH_GROUP_INDEX_SAMPLE = "search.group_index_sample"
    SEARCH_SNUBA_GROUP_ATTRIBUTES_SEARCH_QUERY = "search.snuba.group_attributes_search.query"
    SEARCH_SNUBA_GROUP_ATTRIBUTES_SEARCH_HITS = "search.snuba.group_attributes_search.hits"
    SEER_RPC = "seer.rpc"
    SEER_EXPLORER_INDEX = "seer.explorer_index"
    SEER_EXPLORER_TOOLS = "seer.explorer_tools"
    SERIALIZERS_GROUPSERIALIZERSNUBA__EXECUTE_ERROR_SEEN_STATS_QUERY = (
        "serializers.GroupSerializerSnuba._execute_error_seen_stats_query"
    )
    SERIALIZERS_GROUPSERIALIZERSNUBA__EXECUTE_PERF_SEEN_STATS_QUERY = (
        "serializers.GroupSerializerSnuba._execute_perf_seen_stats_query"
    )
    SERIALIZERS_GROUPSERIALIZERSNUBA__EXECUTE_GENERIC_SEEN_STATS_QUERY = (
        "serializers.GroupSerializerSnuba._execute_generic_seen_stats_query"
    )
    SESSIONS_CRASH_FREE_BREAKDOWN = "sessions.crash-free-breakdown"
    SESSIONS_GET_ADOPTION = "sessions.get-adoption"
    SESSIONS_GET_PROJECT_SESSIONS_COUNT = "sessions.get_project_sessions_count"
    SESSIONS_HEALTH_DATA_CHECK = "sessions.health-data-check"
    SESSIONS_OLDEST_DATA_BACKFILL = "sessions.oldest-data-backfill"
    SESSIONS_RELEASE_ADOPTION_LIST = "sessions.release-adoption-list"
    SESSIONS_RELEASE_ADOPTION_TOTAL_USERS_AND_SESSIONS = (
        "sessions.release-adoption-total-users-and-sessions"
    )
    SESSIONS_RELEASE_OVERVIEW = "sessions.release-overview"
    SESSIONS_RELEASE_SESSIONS_TIME_BOUNDS = "sessions.release-sessions-time-bounds"
    SESSIONS_RELEASE_STATS_DETAILS = "sessions.release-stats-details"
    SESSIONS_RELEASE_STATS = "sessions.release-stats"
    SESSIONS_STABILITY_SORT = "sessions.stability-sort"
    SESSIONS_TIMESERIES = "sessions.timeseries"
    SESSIONS_TOTALS = "sessions.totals"
    SNUBA_METRICS_GET_METRICS_NAMES_FOR_ENTITY = "snuba.metrics.get_metrics_names_for_entity"
    SNUBA_METRICS_META_GET_ENTITY_OF_METRIC_PERFORMANCE = (
        "snuba.metrics.meta.get_entity_of_metric.performance"
    )
    SNUBA_SESSIONS_CHECK_RELEASES_HAVE_HEALTH_DATA = (
        "snuba.sessions.check_releases_have_health_data"
    )
    SNUBA_SESSIONS_GET_PROJECT_RELEASES_COUNT = "snuba.sessions.get_project_releases_count"
    SPIKE_PROJECTIONS = "getsentry.get_spike_projections"
    SRC_SENTRY_INGEST_TRANSACTION_CLUSTERER = "src.sentry.ingest.transaction_clusterer"
    STATISTICAL_DETECTORS_FETCH_TOP_TRANSACTION_NAMES = (
        "statistical_detectors.distributions.fetch_top_transaction_names"
    )
    STATISTICAL_DETECTORS_FETCH_TRANSACTION_TIMESERIES = (
        "statistical_detectors.distributions.fetch_transaction_timeseries"
    )
    SUBSCRIPTION_PROCESSOR_COMPARISON_QUERY = "subscription_processor.comparison_query"
    SUBSCRIPTION_PROCESSOR_COMPARISON_QUERY_PRIMARY = (
        "subscription_processor.comparison_query.primary"
    )
    SUBSCRIPTIONS_EXECUTOR = "subscriptions_executor"
    TAGSTORE__GET_TAG_KEY_AND_TOP_VALUES = "tagstore.__get_tag_key_and_top_values"
    TAGSTORE__GET_TAG_KEYS_AND_TOP_VALUES = "tagstore._get_tag_keys_and_top_values"
    TAGSTORE__GET_TAG_KEYS_AND_TOP_VALUES_EMPTY_COUNTS = (
        "tagstore._get_tag_keys_and_top_values_empty_counts"
    )
    TAGSTORE__GET_TAG_KEYS = "tagstore.__get_tag_keys"
    TAGSTORE_GET_GROUP_LIST_TAG_VALUE = "tagstore.get_group_list_tag_value"
    TAGSTORE_GET_GROUP_TAG_VALUE_ITER = "tagstore.get_group_tag_value_iter"
    TAGSTORE_GET_GROUPS_USER_COUNTS = "tagstore.get_groups_user_counts"
    TAGSTORE_GET_GROUPS_USER_COUNTS_GROUP_SNOOZE = "tagstore.get_groups_user_counts.groupsnooze"
    TAGSTORE_GET_GROUPS_USER_COUNTS_IGNORED = "tagstore.get_groups_user_counts.ignored"
    TAGSTORE_GET_GROUPS_USER_COUNTS_SLACK_ISSUE_NOTIFICATION = (
        "tagstore.get_groups_user_counts.slack_issue_notification"
    )
    TAGSTORE_GET_GENERIC_GROUP_LIST_TAG_VALUE = "tagstore.get_generic_group_list_tag_value"
    TAGSTORE_GET_GENERIC_GROUPS_USER_COUNTS = "tagstore.get_generic_groups_user_counts"
    TAGSTORE_GET_RELEASE_TAGS = "tagstore.get_release_tags"
    TAGSTORE_GET_TAG_VALUE_PAGINATOR_FOR_PROJECTS = "tagstore.get_tag_value_paginator_for_projects"
    TASKS_MONITOR_RELEASE_ADOPTION = "tasks.monitor_release_adoption"
    TASKS_UPDATE_USER_REPORTS = "tasks.update_user_reports"
    TASKS_PERFORMANCE_SPLIT_DISCOVER_DATASET = "tasks.performance.split_discover_dataset"
    TASKS_PERFORMANCE_SPLIT_DISCOVER_DATASET_METRICS_ENHANCED = (
        "tasks.performance.split_discover_dataset.metrics-enhanced"
    )
    TASKS_PROCESS_PROJECTS_WITH_SESSIONS_SESSION_COUNT = (
        "tasks.process_projects_with_sessions.session_count"
    )
    TRANSACTION_ANOMALY_DETECTION = "transaction-anomaly-detection"

    TSDB_MODELID_0 = "tsdb-modelid:0"
    TSDB_MODELID_1 = "tsdb-modelid:1"
    TSDB_MODELID_4 = "tsdb-modelid:4"
    TSDB_MODELID_7 = "tsdb-modelid:7"
    TSDB_MODELID_20 = "tsdb-modelid:20"
    TSDB_MODELID_100 = "tsdb-modelid:100"
    TSDB_MODELID_101 = "tsdb-modelid:101"
    TSDB_MODELID_104 = "tsdb-modelid:104"
    TSDB_MODELID_105 = "tsdb-modelid:105"
    TSDB_MODELID_200 = "tsdb-modelid:200"
    TSDB_MODELID_201 = "tsdb-modelid:201"
    TSDB_MODELID_202 = "tsdb-modelid:202"
    TSDB_MODELID_300 = "tsdb-modelid:300"
    TSDB_MODELID_301 = "tsdb-modelid:301"
    TSDB_MODELID_303 = "tsdb-modelid:303"
    TSDB_MODELID_404 = "tsdb-modelid:404"
    TSDB_MODELID_407 = "tsdb-modelid:407"
    TSDB_MODELID_408 = "tsdb-modelid:408"
    TSDB_MODELID_500 = "tsdb-modelid:500"
    TSDB_MODELID_501 = "tsdb-modelid:501"
    TSDB_MODELID_502 = "tsdb-modelid:502"
    TSDB_MODELID_601 = "tsdb-modelid:601"
    TSDB_MODELID_602 = "tsdb-modelid:602"
    TSDB_MODELID_603 = "tsdb-modelid:603"
    TSDB_MODELID_604 = "tsdb-modelid:604"
    TSDB_MODELID_605 = "tsdb-modelid:605"
    TSDB_MODELID_606 = "tsdb-modelid:606"
    TSDB_MODELID_607 = "tsdb-modelid:607"
    TSDB_MODELID_608 = "tsdb-modelid:608"
    TSDB_MODELID_609 = "tsdb-modelid:609"
    TSDB_MODELID_610 = "tsdb-modelid:610"
    TSDB_MODELID_611 = "tsdb-modelid:611"
    TSDB_MODELID_700 = "tsdb-modelid:700"
    TSDB_MODELID_800 = "tsdb-modelid:800"
    TSDB_MODELID_801 = "tsdb-modelid:801"

    TSDB_MODELID_4_frequency_snoozes = "tsdb-modelid:4.frequency_snoozes"
    TSDB_MODELID_4_alert_event_frequency = "tsdb-modelid:4.alert_event_frequency"
    TSDB_MODELID_4_alert_event_frequency_percent = "tsdb-modelid:4.alert_event_frequency_percent"
    TSDB_MODELID_4_batch_alert_event_frequency = "tsdb-modelid:4.batch_alert_event_frequency"
    TSDB_MODELID_20_alert_event_frequency = "tsdb-modelid:20.alert_event_frequency"
    TSDB_MODELID_300_user_count_snoozes = "tsdb-modelid:300.user_count_snoozes"
    TSDB_MODELID_300_alert_event_uniq_user_frequency = (
        "tsdb-modelid:300.alert_event_uniq_user_frequency"
    )
    TSDB_MODELID_4_wf_batch_alert_event_frequency = "tsdb-modelid:4.wf_batch_alert_event_frequency"
    TSDB_MODELID_4_wf_batch_alert_event_frequency_percent = (
        "tsdb-modelid:4.wf_batch_alert_event_frequency_percent"
    )
    TSDB_MODELID_300_wf_batch_alert_event_uniq_user_frequency = (
        "tsdb-modelid:300.wf_batch_alert_event_uniq_user_frequency"
    )

    UNKNOWN = "unknown"
    UNMERGE = "unmerge"
    WEEKLY_REPORTS_KEY_TRANSACTIONS_LAST_WEEK = "weekly_reports.key_transactions.last_week"
    WEEKLY_REPORTS_KEY_TRANSACTIONS_THIS_WEEK = "weekly_reports.key_transactions.this_week"
    WEEKLY_REPORTS_OUTCOMES = "weekly_reports.outcomes"

    # Referrers used in the migration script for alerts
    ALERTS_MIGRATION_SCRIPT = "alerts.migration_script"
    ALERTS_MIGRATION_SCRIPT_METRICS_ENHANCED = "alerts.migration_script.metrics-enhanced"

    # Getsentry scripts
    DELETE_EVENTS_FROM_FILE = "delete-events-from-file"

    # Referrers in tests
    TESTING_GET_FACETS_TEST = "testing.get-facets-test"
    TESTING_TEST = "testing.test"
    TEST_QUERY_PRIMARY = "test_query.primary"
    TEST_QUERY = "test_query"
    METRIC_VALIDATION = "metric_validation"

    JOB_COMPARE_TIMESERIES = "job-runner.compare-timeseries"


VALUES = {referrer.value for referrer in Referrer}

# These suffixes are automatically added by Query Builder code in certain conditions. Any valid referrer with these suffixes is still a valid referrer.
VALID_SUFFIXES = ["primary", "secondary"]


def is_valid_referrer(referrer: str | None) -> bool:
    if not referrer:
        return True

    if referrer in VALUES:
        return True

    for suffix in VALID_SUFFIXES:
        if referrer.removesuffix(f".{suffix}") in VALUES:
            return True

    return False


def validate_referrer(referrer: str | None) -> bool:
    if is_valid_referrer(referrer):
        return True

    error_message = f"referrer {referrer} is not part of Referrer Enum"

    try:
        raise Exception(error_message)
    except Exception:
        metrics.incr("snql.sdk.api.new_referrers", tags={"referrer": referrer})
        logger.warning(error_message, exc_info=True)

    return False
