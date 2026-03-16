from __future__ import annotations

from dataclasses import dataclass

from sentry.issues.grouptype import (
    GroupCategory,
    GroupType,
    NoiseConfig,
    NotificationConfig,
    NotificationContextField,
)
from sentry.types.group import PriorityLevel


@dataclass(frozen=True)
class PerformanceSlowDBQueryGroupType(GroupType):
    type_id = 1001
    slug = "performance_slow_db_query"
    description = "Slow DB Query"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.DB_QUERY.value
    noise_config = NoiseConfig(ignore_limit=100)
    default_priority = PriorityLevel.LOW
    released = True


@dataclass(frozen=True)
class PerformanceRenderBlockingAssetSpanGroupType(GroupType):
    type_id = 1004
    slug = "performance_render_blocking_asset_span"
    description = "Large Render Blocking Asset"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.FRONTEND.value
    noise_config = NoiseConfig()
    default_priority = PriorityLevel.LOW
    released = True
    use_flagpole_for_all_features = True


@dataclass(frozen=True)
class PerformanceNPlusOneGroupType(GroupType):
    type_id = 1006
    slug = "performance_n_plus_one_db_queries"
    description = "N+1 Query"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.DB_QUERY.value
    noise_config = NoiseConfig()
    default_priority = PriorityLevel.LOW
    released = True


@dataclass(frozen=True)
class PerformanceNPlusOneExperimentalGroupType(GroupType):
    type_id = 1906
    slug = "performance_n_plus_one_db_queries_experimental"
    description = "N+1 Query (Experimental)"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.DB_QUERY.value
    noise_config = NoiseConfig()
    default_priority = PriorityLevel.LOW
    released = False


@dataclass(frozen=True)
class PerformanceConsecutiveDBQueriesGroupType(GroupType):
    type_id = 1007
    slug = "performance_consecutive_db_queries"
    description = "Consecutive DB Queries"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.DB_QUERY.value
    noise_config = NoiseConfig(ignore_limit=15)
    default_priority = PriorityLevel.LOW
    released = True


@dataclass(frozen=True)
class PerformanceFileIOMainThreadGroupType(GroupType):
    type_id = 1008
    slug = "performance_file_io_main_thread"
    description = "File IO on Main Thread"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.MOBILE.value
    noise_config = NoiseConfig()
    default_priority = PriorityLevel.LOW
    released = True


@dataclass(frozen=True)
class PerformanceConsecutiveHTTPQueriesGroupType(GroupType):
    type_id = 1009
    slug = "performance_consecutive_http"
    description = "Consecutive HTTP"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.HTTP_CLIENT.value
    noise_config = NoiseConfig(ignore_limit=5)
    default_priority = PriorityLevel.LOW
    released = True


@dataclass(frozen=True)
class PerformanceNPlusOneAPICallsGroupType(GroupType):
    type_id = 1010
    slug = "performance_n_plus_one_api_calls"
    description = "N+1 API Call"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.HTTP_CLIENT.value
    noise_config = NoiseConfig()
    default_priority = PriorityLevel.LOW
    released = True


@dataclass(frozen=True)
class PerformanceNPlusOneAPICallsExperimentalGroupType(GroupType):
    type_id = 1910
    slug = "performance_n_plus_one_api_calls_experimental"
    description = "N+1 API Call (Experimental)"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.HTTP_CLIENT.value
    noise_config = NoiseConfig()
    default_priority = PriorityLevel.LOW
    released = False


@dataclass(frozen=True)
class PerformanceMNPlusOneDBQueriesGroupType(GroupType):
    """
    This group type is only used for fingerprinting MN+1 DB Performance Issues.
    No field other than `type_id` are referenced, so changes will not have an affect.
    The MN+1 detector uses the PerformanceNPlusOneGroupType, so reference that GroupType instead.
    """

    type_id = 1011
    slug = "performance_m_n_plus_one_db_queries"
    description = "MN+1 Query"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.DB_QUERY.value
    noise_config = NoiseConfig()
    default_priority = PriorityLevel.LOW
    released = True


@dataclass(frozen=True)
class PerformanceMNPlusOneDBQueriesExperimentalGroupType(GroupType):
    type_id = 1911
    slug = "performance_m_n_plus_one_db_queries_experimental"
    description = "MN+1 Query (Experimental)"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.DB_QUERY.value
    noise_config = NoiseConfig()
    default_priority = PriorityLevel.LOW
    released = False


@dataclass(frozen=True)
class PerformanceUncompressedAssetsGroupType(GroupType):
    type_id = 1012
    slug = "performance_uncompressed_assets"
    description = "Uncompressed Asset"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.FRONTEND.value
    noise_config = NoiseConfig(ignore_limit=100)
    default_priority = PriorityLevel.LOW
    released = True


@dataclass(frozen=True)
class PerformanceDBMainThreadGroupType(GroupType):
    type_id = 1013
    slug = "performance_db_main_thread"
    description = "DB on Main Thread"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.MOBILE.value
    noise_config = NoiseConfig()
    default_priority = PriorityLevel.LOW
    released = True


@dataclass(frozen=True)
class PerformanceLargeHTTPPayloadGroupType(GroupType):
    type_id = 1015
    slug = "performance_large_http_payload"
    description = "Large HTTP payload"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.HTTP_CLIENT.value
    noise_config = NoiseConfig()
    default_priority = PriorityLevel.LOW
    released = True


@dataclass(frozen=True)
class PerformanceHTTPOverheadGroupType(GroupType):
    type_id = 1016
    slug = "performance_http_overhead"
    description = "HTTP/1.1 Overhead"
    noise_config = NoiseConfig(ignore_limit=20)
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.HTTP_CLIENT.value
    default_priority = PriorityLevel.LOW
    released = True


@dataclass(frozen=True)
class PerformanceP95EndpointRegressionGroupType(GroupType):
    type_id = 1018
    slug = "performance_p95_endpoint_regression"
    description = "Endpoint Regression"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.METRIC.value
    enable_auto_resolve = False
    enable_escalation_detection = False
    default_priority = PriorityLevel.MEDIUM
    released = True
    notification_config = NotificationConfig(context=[NotificationContextField.APPROX_START_TIME])


# experimental
@dataclass(frozen=True)
class PerformanceStreamedSpansGroupTypeExperimental(GroupType):
    type_id = 1019
    slug = "performance_streamed_spans_exp"
    description = "Streamed Spans (Experimental)"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.METRIC.value
    enable_auto_resolve = False
    enable_escalation_detection = False
    default_priority = PriorityLevel.LOW


# Experimental Group Type for Query Injection Vulnerability
@dataclass(frozen=True)
class DBQueryInjectionVulnerabilityGroupType(GroupType):
    type_id = 1020
    slug = "db_query_injection_vulnerability"
    description = "Potential Database Query Injection Vulnerability"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.DB_QUERY.value
    enable_auto_resolve = False
    enable_escalation_detection = False
    noise_config = NoiseConfig(ignore_limit=5)
    default_priority = PriorityLevel.MEDIUM


@dataclass(frozen=True)
class QueryInjectionVulnerabilityGroupType(GroupType):
    type_id = 1021
    slug = "query_injection_vulnerability"
    description = "Potential Query Injection Vulnerability"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.DB_QUERY.value
    enable_auto_resolve = False
    enable_escalation_detection = False
    noise_config = NoiseConfig(ignore_limit=10)
    default_priority = PriorityLevel.MEDIUM


# 2000 was ProfileBlockingFunctionMainThreadType
@dataclass(frozen=True)
class ProfileFileIOGroupType(GroupType):
    type_id = 2001
    slug = "profile_file_io_main_thread"
    description = "File I/O on Main Thread"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.MOBILE.value
    default_priority = PriorityLevel.LOW
    released = True


@dataclass(frozen=True)
class ProfileImageDecodeGroupType(GroupType):
    type_id = 2002
    slug = "profile_image_decode_main_thread"
    description = "Image Decoding on Main Thread"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.MOBILE.value
    default_priority = PriorityLevel.LOW
    released = True


@dataclass(frozen=True)
class ProfileJSONDecodeType(GroupType):
    type_id = 2003
    slug = "profile_json_decode_main_thread"
    description = "JSON Decoding on Main Thread"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.MOBILE.value
    default_priority = PriorityLevel.LOW
    released = True


@dataclass(frozen=True)
class ProfileRegexType(GroupType):
    type_id = 2007
    slug = "profile_regex_main_thread"
    description = "Regex on Main Thread"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.MOBILE.value
    released = True
    default_priority = PriorityLevel.LOW


@dataclass(frozen=True)
class ProfileFrameDropType(GroupType):
    type_id = 2009
    slug = "profile_frame_drop"
    description = "Frame Drop"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.MOBILE.value
    noise_config = NoiseConfig(ignore_limit=2000)
    released = True
    default_priority = PriorityLevel.LOW


@dataclass(frozen=True)
class ProfileFunctionRegressionType(GroupType):
    type_id = 2011
    slug = "profile_function_regression"
    description = "Function Regression"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.METRIC.value
    enable_auto_resolve = False
    released = True
    default_priority = PriorityLevel.MEDIUM
    notification_config = NotificationConfig(context=[NotificationContextField.APPROX_START_TIME])


@dataclass(frozen=True)
class WebVitalsGroup(GroupType):  # TODO: Rename to WebVitalsGroupType
    type_id = 10001
    slug = "web_vitals"
    description = "Web Vitals"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.FRONTEND.value
    enable_auto_resolve = False
    enable_escalation_detection = False
    enable_status_change_workflow_notifications = False
    enable_workflow_notifications = False
    # Web Vital issues are always triggered for the purpose of using autofix
    always_trigger_seer_automation = True
    released = True
