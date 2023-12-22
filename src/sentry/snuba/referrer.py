from __future__ import annotations

import logging
from enum import Enum, unique

from sentry.utils import metrics

logger = logging.getLogger(__name__)


@unique
class Referrer(Enum):
    ALERTRULESERIALIZER_TEST_QUERY_PRIMARY = "alertruleserializer.test_query.primary"
    ALERTRULESERIALIZER_TEST_QUERY = "alertruleserializer.test_query"
    API_ALERTS_ALERT_RULE_CHART_METRICS_ENHANCED = "api.alerts.alert-rule-chart.metrics-enhanced"
    API_ALERTS_ALERT_RULE_CHART = "api.alerts.alert-rule-chart"
    API_ALERTS_CHARTCUTERIE = "api.alerts.chartcuterie"
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

    # DDM
    API_DDM_FETCH_SPANS = "api.ddm.fetch.spans"
    API_DDM_FETCH_METRICS_SUMMARIES = "api.ddm.fetch.metrics_summaries"

    API_DISCOVER_TOTAL_COUNT_FIELD = "api.discover.total-events-field"
    API_DISCOVER_TOTAL_SUM_TRANSACTION_DURATION_FIELD = (
        "api.discover.total-sum-transaction-duration-field"
    )
    API_DISCOVER_TOTAL_SUM_TRANSACTION_DURATION_FIELD_PRIMARY = (
        "api.discover.total-sum-transaction-duration-field.primary"
    )
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
    API_ISSUES_ISSUE_EVENTS = "api.issues.issue_events"
    API_METRICS_SERIES_SECOND_QUERY = "api.metrics.series.second_query"
    API_METRICS_SERIES = "api.metrics.series"
    API_METRICS_TOTALS_INITIAL_QUERY = "api.metrics.totals.initial_query"
    API_METRICS_TOTALS_SECOND_QUERY = "api.metrics.totals.second_query"
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
    API_PERFORMANCE_EVENTS_FACETS_STATS = (
        "api.organization-events-facets-stats-performance.top-tags"
    )
    API_ORGANIZATION_EVENTS_V2 = "api.organization-events-v2"
    API_ORGANIZATION_EVENTS = "api.organization-events"
    API_ORGANIZATION_METRICS_ESTIMATION_STATS = "api.organization-metrics-estimation-stats"
    API_ORGANIZATION_ISSUE_REPLAY_COUNT = "api.organization-issue-replay-count"
    API_ORGANIZATION_SDK_UPDATES = "api.organization-sdk-updates"
    API_ORGANIZATION_SPANS_HISTOGRAM_MIN_MAX = "api.organization-spans-histogram-min-max"
    API_ORGANIZATION_VITALS_PER_PROJECT = "api.organization-vitals-per-project"
    API_ORGANIZATION_VITALS = "api.organization-vitals"
    API_PERFORMANCE_DURATIONPERCENTILECHART = "api.performance.durationpercentilechart"
    API_PERFORMANCE_GENERIC_WIDGET_CHART_APDEX_AREA_METRICS_ENHANCED = (
        "api.performance.generic-widget-chart.apdex-area.metrics-enhanced"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_APDEX_AREA = (
        "api.performance.generic-widget-chart.apdex-area"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_COLD_STARTUP_AREA_METRICS_ENHANCED = (
        "api.performance.generic-widget-chart.cold-startup-area.metrics-enhanced"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_COLD_STARTUP_AREA = (
        "api.performance.generic-widget-chart.cold-startup-area"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_DURATION_HISTOGRAM = (
        "api.performance.generic-widget-chart.duration-histogram"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_FAILURE_RATE_AREA_METRICS_ENHANCED = (
        "api.performance.generic-widget-chart.failure-rate-area.metrics-enhanced"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_FAILURE_RATE_AREA = (
        "api.performance.generic-widget-chart.failure-rate-area"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_FCP_HISTOGRAM = (
        "api.performance.generic-widget-chart.fcp-histogram"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_FID_HISTOGRAM = (
        "api.performance.generic-widget-chart.fid-histogram"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_FROZEN_FRAMES_AREA = (
        "api.performance.generic-widget-chart.frozen-frames-area"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_LCP_HISTOGRAM = (
        "api.performance.generic-widget-chart.lcp-histogram"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_MOST_FROZEN_FRAMES_METRICS_ENHANCED = (
        "api.performance.generic-widget-chart.most-frozen-frames.metrics-enhanced"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_MOST_FROZEN_FRAMES = (
        "api.performance.generic-widget-chart.most-frozen-frames"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_MOST_IMRPOVED = (
        "api.performance.generic-widget-chart.most-improved"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_MOST_REGRESSED = (
        "api.performance.generic-widget-chart.most-regressed"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_MOST_RELATED_ERRORS = (
        "api.performance.generic-widget-chart.most-related-errors"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_MOST_RELATED_ISSUES = (
        "api.performance.generic-widget-chart.most-related-issues"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_MOST_SLOW_FRAMES_METRICS_ENHANCED = (
        "api.performance.generic-widget-chart.most-slow-frames.metrics-enhanced"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_MOST_SLOW_FRAMES = (
        "api.performance.generic-widget-chart.most-slow-frames"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_P50_DURATION_AREA_METRICS_ENHANCED = (
        "api.performance.generic-widget-chart.p50-duration-area.metrics-enhanced"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_P50_DURATION_AREA = (
        "api.performance.generic-widget-chart.p50-duration-area"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_P75_DURATION_AREA_METRICS_ENHANCED = (
        "api.performance.generic-widget-chart.p75-duration-area.metrics-enhanced"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_P75_DURATION_AREA = (
        "api.performance.generic-widget-chart.p75-duration-area"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_P75_LCP_AREA_METRICS_ENHANCED = (
        "api.performance.generic-widget-chart.p75-lcp-area.metrics-enhanced"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_P75_LCP_AREA = (
        "api.performance.generic-widget-chart.p75-lcp-area"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_P95_DURATION_AREA_METRICS_ENHANCED = (
        "api.performance.generic-widget-chart.p95-duration-area.metrics-enhanced"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_P95_DURATION_AREA = (
        "api.performance.generic-widget-chart.p95-duration-area"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_P99_DURATION_AREA_METRICS_ENHANCED = (
        "api.performance.generic-widget-chart.p99-duration-area.metrics-enhanced"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_P99_DURATION_AREA = (
        "api.performance.generic-widget-chart.p99-duration-area"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_SLOW_BROWSER_OPS_METRICS_ENHANCED = (
        "api.performance.generic-widget-chart.slow-browser-ops.metrics-enhanced"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_SLOW_BROWSER_OPS = (
        "api.performance.generic-widget-chart.slow-browser-ops"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_SLOW_DB_OPS_METRICS_ENHANCED = (
        "api.performance.generic-widget-chart.slow-db-ops.metrics-enhanced"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_SLOW_DB_OPS = (
        "api.performance.generic-widget-chart.slow-db-ops"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_SLOW_FRAMES_AREA_METRICS_ENHANCED = (
        "api.performance.generic-widget-chart.slow-frames-area.metrics-enhanced"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_SLOW_FRAMES_AREA = (
        "api.performance.generic-widget-chart.slow-frames-area"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_SLOW_HTTP_OPS_METRICS_ENHANCED = (
        "api.performance.generic-widget-chart.slow-http-ops.metrics-enhanced"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_SLOW_HTTP_OPS = (
        "api.performance.generic-widget-chart.slow-http-ops"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_SLOW_RESOURCE_OPS_METRICS_ENHANCED = (
        "api.performance.generic-widget-chart.slow-resource-ops.metrics-enhanced"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_SLOW_RESOURCE_OPS = (
        "api.performance.generic-widget-chart.slow-resource-ops"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_TPM_AREA_METRICS_ENHANCED = (
        "api.performance.generic-widget-chart.tpm-area.metrics-enhanced"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_TPM_AREA = "api.performance.generic-widget-chart.tpm-area"
    API_PERFORMANCE_GENERIC_WIDGET_CHART_USER_MISERY_AREA_METRICS_ENHANCED = (
        "api.performance.generic-widget-chart.user-misery-area.metrics-enhanced"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_USER_MISERY_AREA = (
        "api.performance.generic-widget-chart.user-misery-area"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_WARM_STARTUP_AREA_METRICS_ENHANCED = (
        "api.performance.generic-widget-chart.warm-startup-area.metrics-enhanced"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_WARM_STARTUP_AREA = (
        "api.performance.generic-widget-chart.warm-startup-area"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_WORST_CLS_VITALS = (
        "api.performance.generic-widget-chart.worst-cls-vitals"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_WORST_FCP_VITALS_METRICS_ENHANCED = (
        "api.performance.generic-widget-chart.worst-fcp-vitals.metrics-enhanced"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_WORST_FCP_VITALS = (
        "api.performance.generic-widget-chart.worst-fcp-vitals"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_WORST_FID_VITALS_METRICS_ENHANCED = (
        "api.performance.generic-widget-chart.worst-fid-vitals.metrics-enhanced"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_WORST_FID_VITALS = (
        "api.performance.generic-widget-chart.worst-fid-vitals"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_WORST_LCP_VITALS_METRICS_ENHANCED = (
        "api.performance.generic-widget-chart.worst-lcp-vitals.metrics-enhanced"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_WORST_LCP_VITALS = (
        "api.performance.generic-widget-chart.worst-lcp-vitals"
    )
    API_PERFORMANCE_HOMEPAGE_DURATION_CHART = "api.performance.homepage.duration-chart"
    API_PERFORMANCE_HOMEPAGE_WIDGET_CHART = "api.performance.homepage.widget-chart"
    API_PERFORMANCE_LANDING_TABLE_METRICS_ENHANCED_PRIMARY = (
        "api.performance.landing-table.metrics-enhanced.primary"
    )
    API_PERFORMANCE_LANDING_TABLE_METRICS_ENHANCED_SECONDARY = (
        "api.performance.landing-table.metrics-enhanced.secondary"
    )
    API_PERFORMANCE_LANDING_TABLE = "api.performance.landing-table"
    API_PERFORMANCE_STATUS_BREAKDOWN = "api.performance.status-breakdown"
    API_PERFORMANCE_TAG_PAGE = "api.performance.tag-page"
    API_PERFORMANCE_TRANSACTION_SPANS = "api.performance.transaction-spans"
    API_PERFORMANCE_TRANSACTION_SUMMARY_DURATION = "api.performance.transaction-summary.duration"
    API_PERFORMANCE_TRANSACTION_SUMMARY_SIDEBAR_CHART_METRICS_ENHANCED = (
        "api.performance.transaction-summary.sidebar-chart.metrics-enhanced"
    )
    API_PERFORMANCE_TRANSACTION_SUMMARY_SIDEBAR_CHART = (
        "api.performance.transaction-summary.sidebar-chart"
    )
    API_PERFORMANCE_TRANSACTION_SUMMARY_TRENDS_CHART = (
        "api.performance.transaction-summary.trends-chart"
    )
    API_PERFORMANCE_TRANSACTION_SUMMARY_VITALS_CHART = (
        "api.performance.transaction-summary.vitals-chart"
    )
    API_PERFORMANCE_TRANSACTION_SUMMARY = "api.performance.transaction-summary"
    API_PERFORMANCE_TRANSACTIONS_STATISTICAL_DETECTOR_STATS = (
        "api.performance.transactions.statistical-detector-stats"
    )
    API_PERFORMANCE_VITAL_DETAIL = "api.performance.vital-detail"
    API_PERFORMANCE_VITALS_CARDS = "api.performance.vitals-cards"
    API_PROFILING_LANDING_CHART = "api.profiling.landing-chart"
    API_PROFILING_LANDING_TABLE = "api.profiling.landing-table"
    API_PROFILING_LANDING_FUNCTIONS_CARD = "api.profiling.landing-functions-card"
    API_PROFILING_PERFORMANCE_CHANGE_EXPLORER = "api.profiling.performance-change-explorer"
    API_PROFILING_PROFILE_SUMMARY_CHART = "api.profiling.profile-summary-chart"
    API_PROFILING_PROFILE_SUMMARY_TOTALS = "api.profiling.profile-summary-totals"
    API_PROFILING_PROFILE_SUMMARY_TABLE = "api.profiling.profile-summary-table"
    API_PROFILING_PROFILE_SUMMARY_FUNCTIONS_TABLE = "api.profiling.profile-summary-functions-table"
    API_PROFILING_PROFILE_FLAMEGRAPH = "api.profiling.profile-flamegraph"
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
    API_PROFILING_FUNCTIONS_REGRESSION_EXAMPLES = "api.profiling.functions.regression.examples"
    API_PROFILING_FUNCTIONS_REGRESSION_LIST = "api.profiling.functions.regression.list"
    API_PROFILING_FUNCTIONS_REGRESSION_STATS = "api.profiling.functions.regression.stats"
    API_PROFILING_FUNCTIONS_REGRESSION_TRANSACTIONS = (
        "api.profiling.functions.regression.transactions"
    )
    API_PROFILING_FUNCTIONS_REGRESSION_TRANSACTION_STATS = (
        "api.profiling.functions.regression.transaction-stats"
    )
    API_PROJECT_EVENTS = "api.project-events"
    API_RELEASES_RELEASE_DETAILS_CHART = "api.releases.release-details-chart"
    API_REPLAY_DETAILS_PAGE = "api.replay.details-page"

    API_STARFISH_ENDPOINT_LIST = "api.starfish.endpoint-list"
    API_STARFISH_GET_SPAN_ACTIONS = "api.starfish.get-span-actions"
    API_STARFISH_GET_SPAN_DOMAINS = "api.starfish.get-span-domains"
    API_STARFISH_GET_SPAN_OPERATIONS = "api.starfish.get-span-operations"
    API_STARFISH_SIDEBAR_SPAN_METRICS = "api.starfish.sidebar-span-metrics"
    API_STARFISH_SPAN_CATEGORY_BREAKDOWN = "api.starfish-web-service.span-category-breakdown"
    API_STARFISH_SPAN_LIST = "api.starfish.use-span-list"
    API_STARFISH_SPAN_LIST_PRIMARY = "api.starfish.use-span-list.primary"
    API_STARFISH_SPAN_SUMMARY_P95 = "api.starfish.span-summary-panel-samples-table-p95"
    API_STARFISH_SPAN_SUMMARY_PAGE = "api.starfish.span-summary-page-metrics"
    API_STARFISH_SPAN_SUMMARY_PANEL = "api.starfish.span-summary-panel-metrics"
    API_STARFISH_SPAN_SUMMARY_TRANSACTIONS = (
        "api.starfish.span-summary-panel-samples-table-transactions"
    )
    API_STARFISH_SPAN_TRANSACTION_METRICS = "api.starfish.span-transaction-metrics"
    API_STARFISH_TOTAL_TIME = "api.starfish-web-service.total-time"
    API_STARFISH_HOMEPAGE_CHART = "api.starfish-web-service.homepage-chart"

    API_STARFISH_SPAN_CATEGORY_BREAKDOWN_CHART = (
        "api.starfish-web-service.span-category-breakdown-timeseries"
    )
    API_STARFISH_ENDPOINT_OVERVIEW = "api.starfish-web-service.starfish-endpoint-overview"
    API_STARFISH_HTTP_ERROR_COUNT = "api.starfish.get-http-error-count"
    API_STARFISH_SPAN_SUMMARY_PAGE_CHART = "api.starfish.span-summary-page-metrics-chart"
    API_STARFISH_SIDEBAR_SPAN_METRICS_CHART = "api.starfish.sidebar-span-metrics-chart"
    API_STARFISH_SPAN_TIME_CHARTS = "api.starfish.span-time-charts"

    # Mobile Starfish
    API_STARFISH_MOBILE_SCREEN_METRICS_SERIES = "api.starfish.mobile-screen-series"
    API_STARFISH_MOBILE_SCREEN_TABLE = "api.starfish.mobile-screen-table"
    API_STARFISH_MOBILE_SCREEN_BAR_CHART = "api.starfish.mobile-screen-bar-chart"
    API_STARFISH_MOBILE_RELEASE_SELECTOR = "api.starfish.mobile-release-selector"
    API_STARFISH_MOBILE_DEVICE_BREAKDOWN = "api.starfish.mobile-device-breakdown"
    API_STARFISH_MOBILE_EVENT_SAMPLES = "api.starfish.mobile-event-samples"
    API_STARFISH_MOBILE_SCREEN_TOTALS = "api.starfish.mobile-screen-totals"
    API_STARFISH_MOBILE_SPAN_TABLE = "api.starfish.mobile-span-table"
    API_STARFISH_MOBILE_STARTUP_SCREEN_TABLE = "api.starfish.mobile-startup-screen-table"
    API_STARFISH_MOBILE_STARTUP_BAR_CHART = "api.starfish.mobile-startup-bar-chart"
    API_STARFISH_MOBILE_STARTUP_SERIES = "api.starfish.mobile-startup-series"
    API_STARFISH_MOBILE_STARTUP_EVENT_SAMPLES = "api.starfish.mobile-startup-event-samples"
    API_STARFISH_MOBILE_STARTUP_SPAN_TABLE = "api.starfish.mobile-spartup-span-table"
    API_STARFISH_MOBILE_STARTUP_LOADED_LIBRARIES = "api.starfish.mobile-startup-loaded-libraries"

    API_SPAN_SAMPLE_GET_BOUNDS = "api.spans.sample-get-bounds"
    API_SPAN_SAMPLE_GET_SPAN_IDS = "api.spans.sample-get-span-ids"
    API_SPAN_SAMPLE_GET_SPAN_DATA = "api.spans.sample-get-span-data"
    API_SERIALIZER_PROJECTS_GET_STATS = "api.serializer.projects.get_stats"
    API_SERIALIZER_CHECKINS_TRACE_IDS = "api.serializer.checkins.trace-ids"
    API_STARFISH_PROFILE_FLAMEGRAPH = "api.starfish.profile-flamegraph"
    API_TRACE_VIEW_ERRORS_VIEW = "api.trace-view.errors-view"
    API_TRACE_VIEW_GET_EVENTS = "api.trace-view.get-events"
    API_TRACE_VIEW_GET_META = "api.trace-view.get-meta"
    API_TRACE_VIEW_HOVER_CARD = "api.trace-view.hover-card"
    API_TRACE_VIEW_SPAN_DETAIL = "api.trace-view.span-detail"
    API_TRACE_VIEW_COUNT_PERFORMANCE_ISSUES = "api.trace-view.count-performance-issues"
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
    API_VROOM = "api.vroom"
    BACKFILL_PERF_ISSUE_EVENTS = "migration.backfill_perf_issue_events_issue_platform"
    DATA_EXPORT_TASKS_DISCOVER = "data_export.tasks.discover"
    DELETIONS_GROUP = "deletions.group"
    DISCOVER = "discover"
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
    GITHUB_PR_COMMENT_BOT = "tasks.github_comment"
    GROUP_FILTER_BY_EVENT_ID = "group.filter_by_event_id"
    GROUP_GET_LATEST = "Group.get_latest"
    GROUP_UNHANDLED_FLAG = "group.unhandled-flag"
    INCIDENTS_GET_INCIDENT_AGGREGATES_PRIMARY = "incidents.get_incident_aggregates.primary"
    INCIDENTS_GET_INCIDENT_AGGREGATES = "incidents.get_incident_aggregates"
    IS_ESCALATING_GROUP = "sentry.issues.escalating.is_escalating"
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
    REPORTS_KEY_ERRORS = "reports.key_errors"
    REPORTS_KEY_PERFORMANCE_ISSUES = "reports.key_performance_issues"
    REPORTS_KEY_TRANSACTIONS_P95 = "reports.key_transactions.p95"
    REPORTS_KEY_TRANSACTIONS = "reports.key_transactions"
    REPORTS_OUTCOME_SERIES = "reports.outcome_series"
    REPORTS_OUTCOMES = "reports.outcomes"
    REPROCESSING2_REPROCESS_GROUP = "reprocessing2.reprocess_group"
    REPROCESSING2_START_GROUP_REPROCESSING = "reprocessing2.start_group_reprocessing"
    SEARCH_SAMPLE = "search_sample"
    SEARCH = "search"
    SEARCH_GROUP_INDEX = "search.group_index"
    SEARCH_GROUP_INDEX_SAMPLE = "search.group_index_sample"
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
    TAGSTORE__GET_TAG_KEYS = "tagstore.__get_tag_keys"
    TAGSTORE_GET_GROUP_LIST_TAG_VALUE = "tagstore.get_group_list_tag_value"
    TAGSTORE_GET_GROUP_TAG_VALUE_ITER = "tagstore.get_group_tag_value_iter"
    TAGSTORE_GET_GROUPS_USER_COUNTS = "tagstore.get_groups_user_counts"
    TAGSTORE_GET_GENERIC_GROUP_LIST_TAG_VALUE = "tagstore.get_generic_group_list_tag_value"
    TAGSTORE_GET_GENERIC_GROUPS_USER_COUNTS = "tagstore.get_generic_groups_user_counts"
    TAGSTORE_GET_RELEASE_TAGS = "tagstore.get_release_tags"
    TAGSTORE_GET_TAG_VALUE_PAGINATOR_FOR_PROJECTS = "tagstore.get_tag_value_paginator_for_projects"
    TASKS_MONITOR_RELEASE_ADOPTION = "tasks.monitor_release_adoption"
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
    TSDB_MODELID_300_user_count_snoozes = "tsdb-modelid:300.user_count_snoozes"
    TSDB_MODELID_300_alert_event_uniq_user_frequency = (
        "tsdb-modelid:300.alert_event_uniq_user_frequency"
    )

    UNKNOWN = "unknown"
    UNMERGE = "unmerge"
    WEEKLY_REPORTS_KEY_TRANSACTIONS_LAST_WEEK = "weekly_reports.key_transactions.last_week"
    WEEKLY_REPORTS_KEY_TRANSACTIONS_THIS_WEEK = "weekly_reports.key_transactions.this_week"
    WEEKLY_REPORTS_OUTCOMES = "weekly_reports.outcomes"

    # Referrers used in the migration script for alerts
    ALERTS_MIGRATION_SCRIPT = "alerts.migration_script"
    ALERTS_MIGRATION_SCRIPT_METRICS_ENHANCED = "alerts.migration_script.metrics-enhanced"

    # Referrers in tests
    API_METRICS_TOTALS = "api.metrics.totals"
    TESTING_GET_FACETS_TEST = "testing.get-facets-test"
    TESTING_TEST = "testing.test"
    TEST_QUERY_PRIMARY = "test_query.primary"
    TEST_QUERY = "test_query"
    METRIC_VALIDATION = "metric_validation"


VALUES = {referrer.value for referrer in Referrer}


def validate_referrer(referrer: str | None) -> None:
    if not referrer:
        return

    error_message = f"referrer {referrer} is not part of Referrer Enum"
    try:
        if referrer not in VALUES:
            raise Exception(error_message)
    except Exception:
        metrics.incr("snql.sdk.api.new_referrers", tags={"referrer": referrer})
        logger.warning(error_message, exc_info=True)
