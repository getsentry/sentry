from __future__ import annotations

import importlib
import logging
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import timedelta
from enum import IntEnum, StrEnum
from typing import TYPE_CHECKING, Any

import sentry_sdk
from django.apps import apps
from redis.client import StrictRedis
from rediscluster import RedisCluster

from sentry import features
from sentry.features.base import OrganizationFeature
from sentry.ratelimits.sliding_windows import Quota
from sentry.types.group import PriorityLevel
from sentry.utils import metrics
from sentry.workflow_engine.types import DetectorSettings

if TYPE_CHECKING:
    from sentry.models.organization import Organization
    from sentry.models.project import Project

logger = logging.getLogger(__name__)


class GroupCategory(IntEnum):
    ERROR = 1
    """
    Deprecated
    Will be broken out into PERFORMANCE_REGRESSION, PERFORMANCE_BEST_PRACTICE, and RESPONSIVENESS
    """
    PERFORMANCE = 2
    PROFILE = 3  # deprecated, merging with PERFORMANCE
    """
    Deprecated
    Cron types will move to the OUTAGE category
    """
    CRON = 4
    """
    Deprecated
    Replay types will move to the USER_EXPERIENCE category
    """
    REPLAY = 5
    FEEDBACK = 6
    """
    Deprecated
    Uptime types will move to the OUTAGE category
    """
    UPTIME = 7
    """
    Deprecated
    Metric alert types will move to the PERFORMANCE_REGRESSION category
    """
    METRIC_ALERT = 8
    TEST_NOTIFICATION = 9

    # New issue categories (under the organizations:issue-taxonomy flag)
    OUTAGE = 9
    PERFORMANCE_REGRESSION = 10
    USER_EXPERIENCE = 11
    RESPONSIVENESS = 12
    PERFORMANCE_BEST_PRACTICE = 13


GROUP_CATEGORIES_CUSTOM_EMAIL = (
    GroupCategory.ERROR,
    GroupCategory.PERFORMANCE,
    GroupCategory.FEEDBACK,
)
# GroupCategories which have customized email templates. If not included here, will fall back to a generic template.

DEFAULT_IGNORE_LIMIT: int = 3
DEFAULT_EXPIRY_TIME: timedelta = timedelta(hours=24)


class InvalidGroupTypeError(ValueError):
    def __init__(self, group_type_id: int) -> None:
        super().__init__(f"No group type with the id {group_type_id} is registered.")
        self.group_type_id = group_type_id


@dataclass()
class GroupTypeRegistry:
    _registry: dict[int, type[GroupType]] = field(default_factory=dict)
    _slug_lookup: dict[str, type[GroupType]] = field(default_factory=dict)
    _category_lookup: dict[int, set[int]] = field(default_factory=lambda: defaultdict(set))
    _category_lookup_v2: dict[int, set[int]] = field(default_factory=lambda: defaultdict(set))

    def add(self, group_type: type[GroupType]) -> None:
        if self._registry.get(group_type.type_id):
            raise ValueError(
                f"A group type with the type_id {group_type.type_id} has already been registered."
            )
        self._registry[group_type.type_id] = group_type
        self._slug_lookup[group_type.slug] = group_type
        self._category_lookup[group_type.category].add(group_type.type_id)
        self._category_lookup_v2[group_type.category_v2].add(group_type.type_id)

    def all(self) -> list[type[GroupType]]:
        return list(self._registry.values())

    def get_visible(
        self, organization: Organization, actor: Any | None = None
    ) -> list[type[GroupType]]:
        with sentry_sdk.start_span(op="GroupTypeRegistry.get_visible") as span:
            released = [gt for gt in self.all() if gt.released]
            feature_to_grouptype = {
                gt.build_visible_feature_name(): gt for gt in self.all() if not gt.released
            }
            batch_features = features.batch_has(
                list(feature_to_grouptype.keys()), actor=actor, organization=organization
            )
            enabled = []
            if batch_features:
                feature_results = batch_features.get(f"organization:{organization.id}", {})
                enabled = [
                    feature_to_grouptype[feature]
                    for feature, active in feature_results.items()
                    if active
                ]
            span.set_tag("organization_id", organization.id)
            span.set_tag("has_batch_features", batch_features is not None)
            span.set_tag("released", released)
            span.set_tag("enabled", enabled)
            span.set_data("feature_to_grouptype", feature_to_grouptype)
            return released + enabled

    def get_all_group_type_ids(self) -> set[int]:
        return {type.type_id for type in self._registry.values()}

    def get_by_category(self, category: int) -> set[int]:
        return self._category_lookup[category]

    def get_by_category_v2(self, category: int) -> set[int]:
        return self._category_lookup_v2[category]

    def get_by_slug(self, slug: str) -> type[GroupType] | None:
        if slug not in self._slug_lookup:
            return None
        return self._slug_lookup[slug]

    def get_by_type_id(self, id_: int) -> type[GroupType]:
        if id_ not in self._registry:
            raise InvalidGroupTypeError(id_)
        return self._registry[id_]


registry = GroupTypeRegistry()


@dataclass(frozen=True)
class NoiseConfig:
    ignore_limit: int = DEFAULT_IGNORE_LIMIT
    expiry_time: timedelta = DEFAULT_EXPIRY_TIME

    @property
    def expiry_seconds(self) -> int:
        return int(self.expiry_time.total_seconds())


class NotificationContextField(StrEnum):
    EVENTS = "Events"
    USERS_AFFECTED = "Users Affected"
    STATE = "State"
    FIRST_SEEN = "First Seen"
    APPROX_START_TIME = "Approx. Start Time"


@dataclass(frozen=True)
class NotificationConfig:
    text_code_formatted: bool = True  # TODO(cathy): user feedback wants it formatted as text
    context: list[str] = field(
        default_factory=lambda: [
            NotificationContextField.EVENTS,
            NotificationContextField.USERS_AFFECTED,
            NotificationContextField.STATE,
            NotificationContextField.FIRST_SEEN,
        ]
    )  # see SUPPORTED_CONTEXT_DATA for all possible values, order matters!
    actions: list[str] = field(default_factory=lambda: ["archive", "resolve", "assign"])
    extra_action: dict[str, str] = field(
        default_factory=lambda: {}
    )  # TODO(cathy): view monitor button for crons. "text": "", "url": ""


@dataclass(frozen=True)
class GroupType:
    type_id: int
    slug: str
    description: str
    category: int
    # New issue category mapping (under the organizations:issue-taxonomy flag)
    # When GA'd, the original `category` will be removed and this will be renamed to `category`.
    category_v2: int
    noise_config: NoiseConfig | None = None
    default_priority: int = PriorityLevel.MEDIUM
    # If True this group type should be released everywhere. If False, fall back to features to
    # decide if this is released.
    released: bool = False
    # If False this group is excluded from default searches, when there are no filters on issue.category or issue.type.
    in_default_search: bool = True

    # Allow automatic resolution of an issue type, using the project-level option.
    enable_auto_resolve: bool = True
    # Allow escalation forecasts and detection
    enable_escalation_detection: bool = True
    # Quota around many of these issue types can be created per project in a given time window
    creation_quota: Quota = Quota(3600, 60, 5)  # default 5 per hour, sliding window of 60 seconds
    notification_config: NotificationConfig = NotificationConfig()
    detector_settings: DetectorSettings | None = None
    # Controls whether status change (i.e. resolved, regressed) workflow notifications are enabled.
    # Defaults to true to maintain the default workflow notification behavior as it exists for error group types.
    enable_status_change_workflow_notifications: bool = True

    def __init_subclass__(cls: type[GroupType], **kwargs: Any) -> None:
        super().__init_subclass__(**kwargs)
        registry.add(cls)

        if not cls.released:
            features.add(cls.build_visible_feature_name(), OrganizationFeature, True)
            features.add(cls.build_ingest_feature_name(), OrganizationFeature, True)
            features.add(cls.build_post_process_group_feature_name(), OrganizationFeature, True)

    def __post_init__(self) -> None:
        valid_categories = [category.value for category in GroupCategory]
        if self.category not in valid_categories:
            raise ValueError(f"Category must be one of {valid_categories} from GroupCategory.")

    @classmethod
    def allow_ingest(cls, organization: Organization) -> bool:
        if cls.released:
            return True

        return features.has(cls.build_ingest_feature_name(), organization)

    @classmethod
    def allow_post_process_group(cls, organization: Organization) -> bool:
        if cls.released:
            return True

        return features.has(cls.build_post_process_group_feature_name(), organization)

    @classmethod
    def should_detect_escalation(cls) -> bool:
        """
        If enable_escalation_detection=True, then escalation detection is enabled.
        """
        return cls.enable_escalation_detection

    @classmethod
    def build_feature_name_slug(cls) -> str:
        return cls.slug.replace("_", "-")

    @classmethod
    def build_base_feature_name(cls) -> str:
        return f"organizations:issue-{cls.build_feature_name_slug()}"

    @classmethod
    def build_visible_feature_name(cls) -> str:
        return f"{cls.build_base_feature_name()}-visible"

    @classmethod
    def build_ingest_feature_name(cls) -> str:
        return f"{cls.build_base_feature_name()}-ingest"

    @classmethod
    def build_post_process_group_feature_name(cls) -> str:
        return f"{cls.build_base_feature_name()}-post-process-group"


def get_all_group_type_ids() -> set[int]:
    # TODO: Replace uses of this with the registry
    return registry.get_all_group_type_ids()


def get_group_types_by_category(category: int) -> set[int]:
    # TODO: Replace uses of this with the registry
    return registry.get_by_category(category)


def get_group_type_by_slug(slug: str) -> type[GroupType] | None:
    # TODO: Replace uses of this with the registry
    return registry.get_by_slug(slug)


def get_group_type_by_type_id(id: int) -> type[GroupType]:
    # TODO: Replace uses of this with the registry
    return registry.get_by_type_id(id)


# used as an additional superclass for Performance GroupType defaults
class PerformanceGroupTypeDefaults:
    noise_config = NoiseConfig()


class ReplayGroupTypeDefaults:
    notification_config = NotificationConfig(context=[])


@dataclass(frozen=True)
class PerformanceSlowDBQueryGroupType(PerformanceGroupTypeDefaults, GroupType):
    type_id = 1001
    slug = "performance_slow_db_query"
    description = "Slow DB Query"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.PERFORMANCE_BEST_PRACTICE.value
    noise_config = NoiseConfig(ignore_limit=100)
    default_priority = PriorityLevel.LOW
    released = True


@dataclass(frozen=True)
class PerformanceRenderBlockingAssetSpanGroupType(PerformanceGroupTypeDefaults, GroupType):
    type_id = 1004
    slug = "performance_render_blocking_asset_span"
    description = "Large Render Blocking Asset"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.RESPONSIVENESS.value
    default_priority = PriorityLevel.LOW
    released = True
    use_flagpole_for_all_features = True


@dataclass(frozen=True)
class PerformanceNPlusOneGroupType(PerformanceGroupTypeDefaults, GroupType):
    type_id = 1006
    slug = "performance_n_plus_one_db_queries"
    description = "N+1 Query"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.PERFORMANCE_BEST_PRACTICE.value
    default_priority = PriorityLevel.LOW
    released = True


@dataclass(frozen=True)
class PerformanceConsecutiveDBQueriesGroupType(PerformanceGroupTypeDefaults, GroupType):
    type_id = 1007
    slug = "performance_consecutive_db_queries"
    description = "Consecutive DB Queries"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.PERFORMANCE_BEST_PRACTICE.value
    noise_config = NoiseConfig(ignore_limit=15)
    default_priority = PriorityLevel.LOW
    released = True


@dataclass(frozen=True)
class PerformanceFileIOMainThreadGroupType(PerformanceGroupTypeDefaults, GroupType):
    type_id = 1008
    slug = "performance_file_io_main_thread"
    description = "File IO on Main Thread"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.RESPONSIVENESS.value
    default_priority = PriorityLevel.LOW
    released = True


@dataclass(frozen=True)
class PerformanceConsecutiveHTTPQueriesGroupType(PerformanceGroupTypeDefaults, GroupType):
    type_id = 1009
    slug = "performance_consecutive_http"
    description = "Consecutive HTTP"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.PERFORMANCE_BEST_PRACTICE.value
    noise_config = NoiseConfig(ignore_limit=5)
    default_priority = PriorityLevel.LOW
    released = True


@dataclass(frozen=True)
class PerformanceNPlusOneAPICallsGroupType(GroupType):
    type_id = 1010
    slug = "performance_n_plus_one_api_calls"
    description = "N+1 API Call"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.PERFORMANCE_BEST_PRACTICE.value
    default_priority = PriorityLevel.LOW
    released = True


@dataclass(frozen=True)
class PerformanceMNPlusOneDBQueriesGroupType(PerformanceGroupTypeDefaults, GroupType):
    type_id = 1011
    slug = "performance_m_n_plus_one_db_queries"
    description = "MN+1 Query"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.PERFORMANCE_BEST_PRACTICE.value
    default_priority = PriorityLevel.LOW
    released = True


@dataclass(frozen=True)
class PerformanceUncompressedAssetsGroupType(PerformanceGroupTypeDefaults, GroupType):
    type_id = 1012
    slug = "performance_uncompressed_assets"
    description = "Uncompressed Asset"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.PERFORMANCE_BEST_PRACTICE.value
    noise_config = NoiseConfig(ignore_limit=100)
    default_priority = PriorityLevel.LOW
    released = True


@dataclass(frozen=True)
class PerformanceDBMainThreadGroupType(PerformanceGroupTypeDefaults, GroupType):
    type_id = 1013
    slug = "performance_db_main_thread"
    description = "DB on Main Thread"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.RESPONSIVENESS.value
    default_priority = PriorityLevel.LOW
    released = True


@dataclass(frozen=True)
class PerformanceLargeHTTPPayloadGroupType(PerformanceGroupTypeDefaults, GroupType):
    type_id = 1015
    slug = "performance_large_http_payload"
    description = "Large HTTP payload"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.PERFORMANCE_BEST_PRACTICE.value
    default_priority = PriorityLevel.LOW
    released = True


@dataclass(frozen=True)
class PerformanceHTTPOverheadGroupType(PerformanceGroupTypeDefaults, GroupType):
    type_id = 1016
    slug = "performance_http_overhead"
    description = "HTTP/1.1 Overhead"
    noise_config = NoiseConfig(ignore_limit=20)
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.RESPONSIVENESS.value
    default_priority = PriorityLevel.LOW
    released = True


@dataclass(frozen=True)
class PerformanceP95EndpointRegressionGroupType(GroupType):
    type_id = 1018
    slug = "performance_p95_endpoint_regression"
    description = "Endpoint Regression"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.PERFORMANCE_REGRESSION.value
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
    category_v2 = GroupCategory.PERFORMANCE_BEST_PRACTICE.value
    enable_auto_resolve = False
    enable_escalation_detection = False
    default_priority = PriorityLevel.LOW


# 2000 was ProfileBlockingFunctionMainThreadType
@dataclass(frozen=True)
class ProfileFileIOGroupType(GroupType):
    type_id = 2001
    slug = "profile_file_io_main_thread"
    description = "File I/O on Main Thread"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.RESPONSIVENESS.value
    default_priority = PriorityLevel.LOW
    released = True


@dataclass(frozen=True)
class ProfileImageDecodeGroupType(GroupType):
    type_id = 2002
    slug = "profile_image_decode_main_thread"
    description = "Image Decoding on Main Thread"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.RESPONSIVENESS.value
    default_priority = PriorityLevel.LOW
    released = True


@dataclass(frozen=True)
class ProfileJSONDecodeType(GroupType):
    type_id = 2003
    slug = "profile_json_decode_main_thread"
    description = "JSON Decoding on Main Thread"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.RESPONSIVENESS.value
    default_priority = PriorityLevel.LOW
    released = True


@dataclass(frozen=True)
class ProfileRegexType(GroupType):
    type_id = 2007
    slug = "profile_regex_main_thread"
    description = "Regex on Main Thread"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.RESPONSIVENESS.value
    released = True
    default_priority = PriorityLevel.LOW


@dataclass(frozen=True)
class ProfileFrameDropType(GroupType):
    type_id = 2009
    slug = "profile_frame_drop"
    description = "Frame Drop"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.RESPONSIVENESS.value
    noise_config = NoiseConfig(ignore_limit=2000)
    released = True
    default_priority = PriorityLevel.LOW


@dataclass(frozen=True)
class ProfileFunctionRegressionType(GroupType):
    type_id = 2011
    slug = "profile_function_regression"
    description = "Function Regression"
    category = GroupCategory.PERFORMANCE.value
    category_v2 = GroupCategory.PERFORMANCE_BEST_PRACTICE.value
    enable_auto_resolve = False
    released = True
    default_priority = PriorityLevel.MEDIUM
    notification_config = NotificationConfig(context=[NotificationContextField.APPROX_START_TIME])


@dataclass(frozen=True)
class MonitorIncidentType(GroupType):
    type_id = 4001
    slug = "monitor_check_in_failure"
    description = "Crons Monitor Failed"
    category = GroupCategory.CRON.value
    category_v2 = GroupCategory.OUTAGE.value
    released = True
    creation_quota = Quota(3600, 60, 60_000)  # 60,000 per hour, sliding window of 60 seconds
    default_priority = PriorityLevel.HIGH
    notification_config = NotificationConfig(context=[])


# XXX(epurkhiser): We renamed this group type but we keep the alias since we
# store group type in pickles
MonitorCheckInFailure = MonitorIncidentType


@dataclass(frozen=True)
class MonitorCheckInTimeout(MonitorIncidentType):
    # This is deprecated, only kept around for it's type_id
    type_id = 4002


@dataclass(frozen=True)
class MonitorCheckInMissed(MonitorIncidentType):
    # This is deprecated, only kept around for it's type_id
    type_id = 4003


@dataclass(frozen=True)
class ReplayRageClickType(ReplayGroupTypeDefaults, GroupType):
    type_id = 5002
    slug = "replay_click_rage"
    description = "Rage Click Detected"
    category = GroupCategory.REPLAY.value
    category_v2 = GroupCategory.USER_EXPERIENCE.value
    default_priority = PriorityLevel.MEDIUM
    notification_config = NotificationConfig()
    released = True


@dataclass(frozen=True)
class ReplayHydrationErrorType(ReplayGroupTypeDefaults, GroupType):
    type_id = 5003
    slug = "replay_hydration_error"
    description = "Hydration Error Detected"
    category = GroupCategory.REPLAY.value
    category_v2 = GroupCategory.USER_EXPERIENCE.value
    default_priority = PriorityLevel.MEDIUM
    notification_config = NotificationConfig()
    released = True


@dataclass(frozen=True)
class FeedbackGroup(GroupType):
    type_id = 6001
    slug = "feedback"
    description = "Feedback"
    category = GroupCategory.FEEDBACK.value
    category_v2 = GroupCategory.FEEDBACK.value
    creation_quota = Quota(3600, 60, 1000)  # 1000 per hour, sliding window of 60 seconds
    default_priority = PriorityLevel.MEDIUM
    notification_config = NotificationConfig(context=[])
    in_default_search = False  # hide from issues stream
    released = True
    enable_auto_resolve = False
    enable_escalation_detection = False


@dataclass(frozen=True)
class MetricIssuePOC(GroupType):
    type_id = 8002
    slug = "metric_issue_poc"
    description = "Metric Issue POC"
    category = GroupCategory.METRIC_ALERT.value
    category_v2 = GroupCategory.PERFORMANCE_REGRESSION.value
    default_priority = PriorityLevel.HIGH
    enable_auto_resolve = False
    enable_escalation_detection = False
    enable_status_change_workflow_notifications = False


def should_create_group(
    grouptype: type[GroupType],
    client: RedisCluster | StrictRedis,
    grouphash: str,
    project: Project,
) -> bool:
    key = f"grouphash:{grouphash}:{project.id}"
    times_seen = client.incr(key)
    noise_config = grouptype.noise_config

    if not noise_config:
        return True

    over_threshold = times_seen >= noise_config.ignore_limit

    metrics.incr(
        "noise_reduction.should_create_group.threshold",
        tags={
            "over_threshold": over_threshold,
            "group_type": grouptype.slug,
        },
        sample_rate=1.0,
    )

    if over_threshold:
        client.delete(grouphash)
        return True
    else:
        client.expire(key, noise_config.expiry_seconds)
        return False


def import_grouptype() -> None:
    """
    Ensures that grouptype.py is imported in any apps that implement it. We do this to make sure that all implemented
    grouptypes are loaded and registered.
    """
    for app_config in apps.get_app_configs():
        grouptype_module = f"{app_config.name}.grouptype"
        try:
            # Try to import the module
            importlib.import_module(grouptype_module)
            logger.debug("Imported module", extra={"module_name": grouptype_module})
        except ModuleNotFoundError:
            # If the module is not found, continue without any issues
            logger.debug("No grouptypes found for app", extra={"app": app_config.name})
