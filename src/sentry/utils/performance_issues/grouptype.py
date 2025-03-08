from dataclasses import dataclass

from sentry.issues.grouptype import (
    GroupCategory,
    GroupType,
    NoiseConfig,
    NotificationConfig,
    NotificationContextField,
)
from sentry.types.group import PriorityLevel
from sentry.utils.performance_issues.detector_handlers.n_plus_one_api_calls_detector_handler import (
    NPlusOneAPICallsDetectorHandler,
)


# used as an additional superclass for Performance GroupType defaults
class PerformanceGroupTypeDefaults:
    noise_config = NoiseConfig()


@dataclass(frozen=True)
class PerformanceSlowDBQueryGroupType(PerformanceGroupTypeDefaults, GroupType):
    type_id = 1001
    slug = "performance_slow_db_query"
    description = "Slow DB Query"
    category = GroupCategory.PERFORMANCE.value
    noise_config = NoiseConfig(ignore_limit=100)
    default_priority = PriorityLevel.LOW
    released = True


@dataclass(frozen=True)
class PerformanceRenderBlockingAssetSpanGroupType(PerformanceGroupTypeDefaults, GroupType):
    type_id = 1004
    slug = "performance_render_blocking_asset_span"
    description = "Large Render Blocking Asset"
    category = GroupCategory.PERFORMANCE.value
    default_priority = PriorityLevel.LOW
    released = True


@dataclass(frozen=True)
class PerformanceNPlusOneGroupType(PerformanceGroupTypeDefaults, GroupType):
    type_id = 1006
    slug = "performance_n_plus_one_db_queries"
    description = "N+1 Query"
    category = GroupCategory.PERFORMANCE.value
    default_priority = PriorityLevel.LOW
    released = True
    detector_handler = NPlusOneAPICallsDetectorHandler


@dataclass(frozen=True)
class PerformanceConsecutiveDBQueriesGroupType(PerformanceGroupTypeDefaults, GroupType):
    type_id = 1007
    slug = "performance_consecutive_db_queries"
    description = "Consecutive DB Queries"
    category = GroupCategory.PERFORMANCE.value
    noise_config = NoiseConfig(ignore_limit=15)
    default_priority = PriorityLevel.LOW
    released = True


@dataclass(frozen=True)
class PerformanceFileIOMainThreadGroupType(PerformanceGroupTypeDefaults, GroupType):
    type_id = 1008
    slug = "performance_file_io_main_thread"
    description = "File IO on Main Thread"
    category = GroupCategory.PERFORMANCE.value
    default_priority = PriorityLevel.LOW
    released = True


@dataclass(frozen=True)
class PerformanceConsecutiveHTTPQueriesGroupType(PerformanceGroupTypeDefaults, GroupType):
    type_id = 1009
    slug = "performance_consecutive_http"
    description = "Consecutive HTTP"
    category = GroupCategory.PERFORMANCE.value
    noise_config = NoiseConfig(ignore_limit=5)
    default_priority = PriorityLevel.LOW
    released = True


@dataclass(frozen=True)
class PerformanceNPlusOneAPICallsGroupType(GroupType):
    type_id = 1010
    slug = "performance_n_plus_one_api_calls"
    description = "N+1 API Call"
    category = GroupCategory.PERFORMANCE.value
    default_priority = PriorityLevel.LOW
    released = True


@dataclass(frozen=True)
class PerformanceMNPlusOneDBQueriesGroupType(PerformanceGroupTypeDefaults, GroupType):
    type_id = 1011
    slug = "performance_m_n_plus_one_db_queries"
    description = "MN+1 Query"
    category = GroupCategory.PERFORMANCE.value
    default_priority = PriorityLevel.LOW
    released = True


@dataclass(frozen=True)
class PerformanceUncompressedAssetsGroupType(PerformanceGroupTypeDefaults, GroupType):
    type_id = 1012
    slug = "performance_uncompressed_assets"
    description = "Uncompressed Asset"
    category = GroupCategory.PERFORMANCE.value
    noise_config = NoiseConfig(ignore_limit=100)
    default_priority = PriorityLevel.LOW
    released = True


@dataclass(frozen=True)
class PerformanceDBMainThreadGroupType(PerformanceGroupTypeDefaults, GroupType):
    type_id = 1013
    slug = "performance_db_main_thread"
    description = "DB on Main Thread"
    category = GroupCategory.PERFORMANCE.value
    default_priority = PriorityLevel.LOW
    released = True


@dataclass(frozen=True)
class PerformanceLargeHTTPPayloadGroupType(PerformanceGroupTypeDefaults, GroupType):
    type_id = 1015
    slug = "performance_large_http_payload"
    description = "Large HTTP payload"
    category = GroupCategory.PERFORMANCE.value
    default_priority = PriorityLevel.LOW
    released = True


@dataclass(frozen=True)
class PerformanceHTTPOverheadGroupType(PerformanceGroupTypeDefaults, GroupType):
    type_id = 1016
    slug = "performance_http_overhead"
    description = "HTTP/1.1 Overhead"
    noise_config = NoiseConfig(ignore_limit=20)
    category = GroupCategory.PERFORMANCE.value
    default_priority = PriorityLevel.LOW


# experimental
@dataclass(frozen=True)
class PerformanceDurationRegressionGroupType(GroupType):
    type_id = 1017
    slug = "performance_duration_regression"
    description = "Transaction Duration Regression (Experimental)"
    category = GroupCategory.PERFORMANCE.value
    enable_auto_resolve = False
    enable_escalation_detection = False
    default_priority = PriorityLevel.LOW
    notification_config = NotificationConfig(context=[NotificationContextField.APPROX_START_TIME])


@dataclass(frozen=True)
class PerformanceP95EndpointRegressionGroupType(GroupType):
    type_id = 1018
    slug = "performance_p95_endpoint_regression"
    description = "Endpoint Regression"
    category = GroupCategory.PERFORMANCE.value
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
    enable_auto_resolve = False
    enable_escalation_detection = False
    default_priority = PriorityLevel.LOW
