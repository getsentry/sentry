from enum import Enum, unique
from typing import Optional

from sentry.utils import metrics


@unique
class Referrer(Enum):
    ALERTRULESERIALIZER_TEST_QUERY = "alertruleserializer.test_query"
    ALERTRULESERIALIZER_TEST_QUERY_PRIMARY = "alertruleserializer.test_query.primary"
    API_ALERTS_ALERT_RULE_CHART = "api.alerts.alert-rule-chart"
    API_AUTH_TOKEN_EVENTS = "api.auth-token.events"
    API_DASHBOARDS_BIGNUMBERWIDGET = "api.dashboards.bignumberwidget"
    API_DASHBOARDS_TABLEWIDGET = "api.dashboards.tablewidget"
    API_DASHBOARDS_TABLEWIDGET_METRICS_ENHANCED_PRIMARY = (
        "api.dashboards.tablewidget.metrics-enhanced.primary"
    )
    API_DASHBOARDS_TOP_EVENTS = "api.dashboards.top-events"
    API_DASHBOARDS_WIDGET_AREA_CHART = "api.dashboards.widget.area-chart"
    API_DASHBOARDS_WIDGET_AREA_CHART_FIND_TOPN = "api.dashboards.widget.area-chart.find-topn"
    API_DASHBOARDS_WIDGET_AREA_CHART_METRICS_ENHANCED = (
        "api.dashboards.widget.area-chart.metrics-enhanced"
    )
    API_DASHBOARDS_WIDGET_BAR_CHART = "api.dashboards.widget.bar-chart"
    API_DASHBOARDS_WIDGET_BAR_CHART_FIND_TOPN = "api.dashboards.widget.bar-chart.find-topn"
    API_DASHBOARDS_WIDGET_LINE_CHART = "api.dashboards.widget.line-chart"
    API_DASHBOARDS_WIDGET_LINE_CHART_FIND_TOPN = "api.dashboards.widget.line-chart.find-topn"
    API_DASHBOARDS_WORLDMAPWIDGET = "api.dashboards.worldmapwidget"
    API_DISCOVER_DAILY_CHART = "api.discover.daily-chart"
    API_DISCOVER_DAILYTOP5_CHART = "api.discover.dailytop5-chart"
    API_DISCOVER_DAILYTOP5_CHART_FIND_TOPN = "api.discover.dailytop5-chart.find-topn"
    API_DISCOVER_DEFAULT_CHART = "api.discover.default-chart"
    API_DISCOVER_PREBUILT_CHART = "api.discover.prebuilt-chart"
    API_DISCOVER_PREVIOUS_CHART = "api.discover.previous-chart"
    API_DISCOVER_QUERY_TABLE = "api.discover.query-table"
    API_DISCOVER_TOP5_CHART = "api.discover.top5-chart"
    API_DISCOVER_TOP5_CHART_FIND_TOPN = "api.discover.top5-chart.find-topn"
    API_DISCOVER_TRANSACTIONS_LIST = "api.discover.transactions-list"
    API_EVENTS_MEASUREMENTS = "api.events.measurements"
    API_EVENTS_VITALS = "api.events.vitals"
    API_GROUP_HASHES_LEVELS_GET_LEVEL_NEW_ISSUES = "api.group_hashes_levels.get_level_new_issues"
    API_GROUP_HASHES_LEVELS_GET_LEVELS_OVERVIEW = "api.group_hashes_levels.get_levels_overview"
    API_GROUP_EVENTS_ERROR = "api.group-events.error"
    API_GROUP_EVENTS_PERFORMANCE = "api.group-events.performance"
    API_GROUP_EVENTS_ERROR_DIRECT_HIT = "api.group-events.error.direct-hit"
    API_GROUP_EVENTS_PERFORMANCE_DIRECT_HIT = "api.group-events.performance.direct-hit"
    API_GROUP_HASHES = "api.group-hashes"
    API_ORGANIZATION_EVENT_STATS = "api.organization-event-stats"
    API_ORGANIZATION_EVENT_STATS_FIND_TOPN = "api.organization-event-stats.find-topn"
    API_ORGANIZATION_EVENTS = "api.organization-events"
    API_ORGANIZATION_EVENTS_FACETS_PERFORMANCE_HISTOGRAM = (
        "api.organization-events-facets-performance-histogram"
    )
    API_ORGANIZATION_EVENTS_FACETS_PERFORMANCE_HISTOGRAM_TOP_TAGS = (
        "api.organization-events-facets-performance-histogram.top_tags"
    )
    API_ORGANIZATION_EVENTS_FACETS_PERFORMANCE_TOP_TAGS_ALL_TRANSACTIONS = (
        "api.organization-events-facets-performance.top-tags.all_transactions"
    )
    API_ORGANIZATION_EVENTS_FACETS_PERFORMANCE_TOP_TAGS_TAG_VALUES = (
        "api.organization-events-facets-performance.top-tags.tag_values"
    )
    API_ORGANIZATION_EVENTS_FACETS_TOP_TAGS = "api.organization-events-facets.top-tags"
    API_ORGANIZATION_EVENTS_GEO = "api.organization-events-geo"
    API_ORGANIZATION_EVENTS_HISTOGRAM = "api.organization-events-histogram"
    API_ORGANIZATION_EVENTS_HISTOGRAM_MIN_MAX = "api.organization-events-histogram-min-max"
    API_ORGANIZATION_EVENTS_META = "api.organization-events-meta"
    API_ORGANIZATION_EVENTS_SPAN_OPS = "api.organization-events-span-ops"
    API_ORGANIZATION_EVENTS_SPANS_HISTOGRAM = "api.organization-events-spans-histogram"
    API_ORGANIZATION_EVENTS_SPANS_PERFORMANCE_EXAMPLES = (
        "api.organization-events-spans-performance-examples"
    )
    API_ORGANIZATION_EVENTS_SPANS_PERFORMANCE_STATS = (
        "api.organization-events-spans-performance-stats"
    )
    API_ORGANIZATION_EVENTS_SPANS_PERFORMANCE_SUSPECTS = (
        "api.organization-events-spans-performance-suspects"
    )
    API_ORGANIZATION_EVENTS_V2 = "api.organization-events-v2"
    API_ORGANIZATION_SDK_UPDATES = "api.organization-sdk-updates"
    API_ORGANIZATION_SPANS_HISTOGRAM_MIN_MAX = "api.organization-spans-histogram-min-max"
    API_ISSUES_ISSUE_EVENTS = "api.issues.issue_events"
    API_PERFORMANCE_DURATIONPERCENTILECHART = "api.performance.durationpercentilechart"
    API_PERFORMANCE_GENERIC_WIDGET_CHART_APDEX_AREA = (
        "api.performance.generic-widget-chart.apdex-area"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_COLD_STARTUP_AREA = (
        "api.performance.generic-widget-chart.cold-startup-area"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_DURATION_HISTOGRAM = (
        "api.performance.generic-widget-chart.duration-histogram"
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
    API_PERFORMANCE_GENERIC_WIDGET_CHART_MOST_FROZEN_FRAMES = (
        "api.performance.generic-widget-chart.most-frozen-frames"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_MOST_IMRPOVED = (
        "api.performance.generic-widget-chart.most-improved"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_MOST_RELATED_ERRORS = (
        "api.performance.generic-widget-chart.most-related-errors"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_MOST_RELATED_ISSUES = (
        "api.performance.generic-widget-chart.most-related-issues"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_MOST_REGRESSED = (
        "api.performance.generic-widget-chart.most-regressed"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_MOST_SLOW_FRAMES = (
        "api.performance.generic-widget-chart.most-slow-frames"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_P50_DURATION_AREA = (
        "api.performance.generic-widget-chart.p50-duration-area"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_P75_DURATION_AREA = (
        "api.performance.generic-widget-chart.p75-duration-area"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_P75_LCP_AREA = (
        "api.performance.generic-widget-chart.p75-lcp-area"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_P95_DURATION_AREA = (
        "api.performance.generic-widget-chart.p95-duration-area"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_P99_DURATION_AREA = (
        "api.performance.generic-widget-chart.p99-duration-area"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_SLOW_BROWSER_OPS = (
        "api.performance.generic-widget-chart.slow-browser-ops"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_SLOW_DB_OPS = (
        "api.performance.generic-widget-chart.slow-db-ops"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_SLOW_FRAMES_AREA = (
        "api.performance.generic-widget-chart.slow-frames-area"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_SLOW_HTTP_OPS = (
        "api.performance.generic-widget-chart.slow-http-ops"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_SLOW_RESOURCE_OPS = (
        "api.performance.generic-widget-chart.slow-resource-ops"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_TPM_AREA = "api.performance.generic-widget-chart.tpm-area"
    API_PERFORMANCE_GENERIC_WIDGET_CHART_USER_MISERY_AREA = (
        "api.performance.generic-widget-chart.user-misery-area"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_WARM_STARTUP_AREA = (
        "api.performance.generic-widget-chart.warm-startup-area"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_WORST_CLS_VITALS = (
        "api.performance.generic-widget-chart.worst-cls-vitals"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_WORST_FCP_VITALS = (
        "api.performance.generic-widget-chart.worst-fcp-vitals"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_WORST_FID_VITALS = (
        "api.performance.generic-widget-chart.worst-fid-vitals"
    )
    API_PERFORMANCE_GENERIC_WIDGET_CHART_WORST_LCP_VITALS = (
        "api.performance.generic-widget-chart.worst-lcp-vitals"
    )
    API_PERFORMANCE_HOMEPAGE_DURATION_CHART = "api.performance.homepage.duration-chart"
    API_PERFORMANCE_HOMEPAGE_WIDGET_CHART = "api.performance.homepage.widget-chart"
    API_PERFORMANCE_LANDING_TABLE = "api.performance.landing-table"
    API_PERFORMANCE_STATUS_BREAKDOWN = "api.performance.status-breakdown"
    API_PERFORMANCE_TAG_PAGE = "api.performance.tag-page"
    API_PERFORMANCE_TRANSACTION_SPANS = "api.performance.transaction-spans"
    API_PERFORMANCE_TRANSACTION_SUMMARY = "api.performance.transaction-summary"
    API_PERFORMANCE_TRANSACTION_SUMMARY_DURATION = "api.performance.transaction-summary.duration"
    API_PERFORMANCE_TRANSACTION_SUMMARY_SIDEBAR_CHART = (
        "api.performance.transaction-summary.sidebar-chart"
    )
    API_PERFORMANCE_TRANSACTION_SUMMARY_TRENDS_CHART = (
        "api.performance.transaction-summary.trends-chart"
    )
    API_PERFORMANCE_TRANSACTION_SUMMARY_VITALS_CHART = (
        "api.performance.transaction-summary.vitals-chart"
    )
    API_PERFORMANCE_VITAL_DETAIL = "api.performance.vital-detail"
    API_PERFORMANCE_VITALS_CARDS = "api.performance.vitals-cards"
    API_PROJECT_EVENTS = "api.project-events"
    API_RELEASES_RELEASE_DETAILS_CHART = "api.releases.release-details-chart"
    API_REPLAY_DETAILS_PAGE = "api.replay.details-page"
    API_SERIALIZER_PROJECTS_GET_STATS = "api.serializer.projects.get_stats"
    API_TRACE_VIEW_ERRORS_VIEW = "api.trace-view.errors-view"
    API_TRACE_VIEW_GET_EVENTS = "api.trace-view.get-events"
    API_TRACE_VIEW_GET_META = "api.trace-view.get-meta"
    API_TRACE_VIEW_HOVER_CARD = "api.trace-view.hover-card"
    API_TRACE_VIEW_SPAN_DETAIL = "api.trace-view.span-detail"
    API_TRENDS_GET_EVENT_STATS = "api.trends.get-event-stats"
    API_TRENDS_GET_PERCENTAGE_CHANGE = "api.trends.get-percentage-change"
    API_VROOM = "api.vroom"
    DATA_EXPORT_TASKS_DISCOVER = "data_export.tasks.discover"
    DELETIONS_GROUP = "deletions.group"
    DISCOVER = "discover"
    DYNAMIC_SAMPLING_DISTRIBUTION_FETCH_TRANSACTIONS = (
        "dynamic-sampling.distribution.fetch-transactions"
    )
    DYNAMIC_SAMPLING_DISTRIBUTION_FETCH_TRANSACTIONS_COUNT = (
        "dynamic-sampling.distribution.fetch-transactions-count"
    )
    DYNAMIC_SAMPLING_DISTRIBUTION_FETCH_PROJECT_BREAKDOWN = (
        "dynamic-sampling.distribution.fetch-project-breakdown"
    )
    DYNAMIC_SAMPLING_DISTRIBUTION_GET_MOST_RECENT_DAY_WITH_TRANSACTIONS = (
        "dynamic-sampling.distribution.get-most-recent-day-with-transactions"
    )
    DYNAMIC_SAMPLING_DISTRIBUTION_FETCH_PROJECT_STATS = (
        "dynamic-sampling.distribution.fetch-project-stats"
    )
    DYNAMIC_SAMPLING_DISTRIBUTION_FETCH_PROJECT_SDK_VERSIONS_INFO = (
        "dynamic-sampling.distribution.fetch-project-sdk-versions-info"
    )
    EVENTSTORE_GET_EVENT_BY_ID_NODESTORE = "eventstore.get_event_by_id_nodestore"
    EVENTSTORE_GET_EVENTS = "eventstore.get_events"
    EVENTSTORE_GET_NEXT_OR_PREV_EVENT_ID = "eventstore.get_next_or_prev_event_id"
    GETSENTRY_API_PENDO_DETAILS = "getsentry.api.pendo-details"
    GROUP_FILTER_BY_EVENT_ID = "group.filter_by_event_id"
    GROUP_GET_LATEST = "group.get_latest"
    GROUP_UNHANDLED_FLAG = "group.unhandled-flag"
    INCIDENTS_GET_INCIDENT_AGGREGATES = "incidents.get_incident_aggregates"
    OUTCOMES_TIMESERIES = "outcomes.timeseries"
    OUTCOMES_TOTALS = "outcomes.totals"
    SEARCH = "search"
    SEARCH_SAMPLE = "search_sample"
    SERIALIZERS_GROUPSERIALIZERSNUBA__EXECUTE_ERROR_SEEN_STATS_QUERY = (
        "serializers.groupserializersnuba._execute_error_seen_stats_query"
    )
    SERIALIZERS_GROUPSERIALIZERSNUBA__EXECUTE_PERF_SEEN_STATS_QUERY = (
        "serializers.groupserializersnuba._execute_perf_seen_stats_query"
    )
    SESSIONS_CRASH_FREE_BREAKDOWN = "sessions.crash-free-breakdown"
    SESSIONS_GET_PROJECT_SESSIONS_COUNT = "sessions.get_project_sessions_count"
    SESSIONS_GET_ADOPTION = "sessions.get-adoption"
    SESSIONS_HEALTH_DATA_CHECK = "sessions.health-data-check"
    SESSIONS_OLDEST_DATA_BACKFILL = "sessions.oldest-data-backfill"
    SESSIONS_RELEASE_ADOPTION_LIST = "sessions.release-adoption-list"
    SESSIONS_RELEASE_ADOPTION_TOTAL_USERS_AND_SESSIONS = (
        "sessions.release-adoption-total-users-and-sessions"
    )
    SESSIONS_RELEASE_OVERVIEW = "sessions.release-overview"
    SESSIONS_RELEASE_SESSIONS_TIME_BOUNDS = "sessions.release-sessions-time-bounds"
    SESSIONS_RELEASE_STATS = "sessions.release-stats"
    SESSIONS_RELEASE_STATS_DETAILS = "sessions.release-stats-details"
    SESSIONS_STABILITY_SORT = "sessions.stability-sort"
    SESSIONS_TIMESERIES = "sessions.timeseries"
    SESSIONS_TOTALS = "sessions.totals"
    SNUBA_METRICS_GET_METRICS_NAMES_FOR_ENTITY = "snuba.metrics.get_metrics_names_for_entity"
    SNUBA_SESSIONS_CHECK_RELEASES_HAVE_HEALTH_DATA = (
        "snuba.sessions.check_releases_have_health_data"
    )
    SNUBA_SESSIONS_GET_PROJECT_RELEASES_COUNT = "snuba.sessions.get_project_releases_count"
    SUBSCRIPTION_PROCESSOR_COMPARISON_QUERY = "subscription_processor.comparison_query"
    SUBSCRIPTIONS_EXECUTOR = "subscriptions_executor"
    TAGSTORE__GET_TAG_KEY_AND_TOP_VALUES = "tagstore._get_tag_key_and_top_values"
    TAGSTORE__GET_TAG_KEYS = "tagstore._get_tag_keys"
    TAGSTORE__GET_TAG_KEYS_AND_TOP_VALUES = "tagstore._get_tag_keys_and_top_values"
    TAGSTORE_GET_GROUP_LIST_TAG_VALUE = "tagstore.get_group_list_tag_value"
    TAGSTORE_GET_GROUP_TAG_VALUE_ITER = "tagstore.get_group_tag_value_iter"
    TAGSTORE_GET_GROUPS_USER_COUNTS = "tagstore.get_groups_user_counts"
    TAGSTORE_GET_RELEASE_TAGS = "tagstore.get_release_tags"
    TAGSTORE_GET_TAG_VALUE_PAGINATOR_FOR_PROJECTS = "tagstore.get_tag_value_paginator_for_projects"
    TASKS_MONITOR_RELEASE_ADOPTION = "tasks.monitor_release_adoption"
    TASKS_PROCESS_PROJECTS_WITH_SESSIONS_SESSION_COUNT = (
        "tasks.process_projects_with_sessions.session_count"
    )
    TRANSACTION_ANOMALY_DETECTION = "transaction-anomaly-detection"
    TSDB_MODELID_1 = "tsdb-modelid:1"
    TSDB_MODELID_100 = "tsdb-modelid:100"
    TSDB_MODELID_101 = "tsdb-modelid:101"
    TSDB_MODELID_104 = "tsdb-modelid:104"
    TSDB_MODELID_200 = "tsdb-modelid:200"
    TSDB_MODELID_201 = "tsdb-modelid:201"
    TSDB_MODELID_202 = "tsdb-modelid:202"
    TSDB_MODELID_300 = "tsdb-modelid:300"
    TSDB_MODELID_4 = "tsdb-modelid:4"
    TSDB_MODELID_407 = "tsdb-modelid:407"
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
    UNKNOWN = "unknown"
    UNMERGE = "unmerge"

    # Referrers in tests
    API_METRICS_TOTALS = "api.metrics.totals"
    TESTING_GET_FACETS_TEST = "testing.get-facets-test"
    TESTING_TEST = "testing.test"
    TEST_QUERY_PRIMARY = "test_query.primary"
    TEST_QUERY = "test_query"


def validate_referrer(referrer: Optional[str]):
    if not referrer:
        return

    referrers = {referrer.value for referrer in Referrer}
    if referrer not in referrers:
        metrics.incr("snql.sdk.api.new_referrers", tags={"referrer": referrer})
