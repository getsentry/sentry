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
from django.db.models import Q
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
    Will be broken out into METRIC, DB_QUERY, HTTP_CLIENT, FRONTEND, MOBILE
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
    Replay types will move to the FRONTEND category
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
    Metric alert types will move to the METRIC category
    """
    METRIC_ALERT = 8
    TEST_NOTIFICATION = 9

    # New issue categories (under the organizations:issue-taxonomy flag)
    OUTAGE = 10
    METRIC = 11
    DB_QUERY = 12
    HTTP_CLIENT = 13
    FRONTEND = 14
    MOBILE = 15

    AI_DETECTED = 16

    """
    Issues detected from analysis of uploaded artifacts. This covers
    both issues detected in a single build (e.g. not 16kb page ready)
    and those detected between builds (e.g. binary size regression).
    """
    PREPROD = 17

    """
    Issues detected by autopilot instrumentation analysis suggesting
    improvements to product usage and observability coverage.
    """
    INSTRUMENTATION = 18

    """
    Issues detected from SDK/tooling configuration problems,
    such as missing or broken source maps.
    """
    CONFIGURATION = 19


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

    def add(self, group_type: type[GroupType]) -> None:
        if self._registry.get(group_type.type_id):
            raise ValueError(
                f"A group type with the type_id {group_type.type_id} has already been registered."
            )
        self._registry[group_type.type_id] = group_type
        self._slug_lookup[group_type.slug] = group_type
        self._category_lookup[group_type.category].add(group_type.type_id)
        self._category_lookup[group_type.category_v2].add(group_type.type_id)

    def all(self) -> list[type[GroupType]]:
        return list(self._registry.values())

    def get_visible(
        self, organization: Organization, actor: Any | None = None
    ) -> list[type[GroupType]]:
        with sentry_sdk.start_span(op="GroupTypeRegistry.get_visible") as span:
            released = [gt for gt in self.all() if gt.released]
            feature_to_grouptype: dict[str, type[GroupType]] = {}
            for gt in self.all():
                if not gt.released:
                    for fname in gt.build_visible_feature_name():
                        feature_to_grouptype[fname] = gt
            batch_features = features.batch_has(
                list(feature_to_grouptype.keys()), actor=actor, organization=organization
            )
            enabled: list[type[GroupType]] = []
            if batch_features:
                feature_results = batch_features.get(f"organization:{organization.id}", {})
                seen: set[int] = set()
                for feature, active in feature_results.items():
                    if active:
                        gt = feature_to_grouptype[feature]
                        if gt.type_id not in seen:
                            seen.add(gt.type_id)
                            enabled.append(gt)
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

    def get_by_slug(self, slug: str) -> type[GroupType] | None:
        if slug not in self._slug_lookup:
            return None
        return self._slug_lookup[slug]

    def get_by_type_id(self, id_: int) -> type[GroupType]:
        if id_ not in self._registry:
            raise InvalidGroupTypeError(id_)
        return self._registry[id_]

    def get_detector_type_filters(self) -> Q:
        """
        Build a Q object that combines all detector type-specific filters.

        For detector types without filters, they're included by default via a NOT IN clause.
        For detector types with filters, we apply the specific filter condition.

        This optimizes the query since most detector types won't have filters.
        """
        types_with_filters = []
        filtered_type_conditions = Q()

        for group_type in self.all():
            if group_type.detector_settings and group_type.detector_settings.filter is not None:
                filter = group_type.detector_settings.filter
                types_with_filters.append(group_type.slug)
                filtered_type_conditions |= Q(type=group_type.slug) & filter

        # Include all types that don't have filters (type NOT IN types_with_filters)
        # OR match the specific filter conditions for types that do have filters
        return ~Q(type__in=types_with_filters) | filtered_type_conditions


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
    # Allows delayed creation of issues for this group type until the issue is seen `noise_config.ignore_limit` times.
    # Then a new issue is created, ignoring past events.
    noise_config: NoiseConfig | None = None
    default_priority: int = PriorityLevel.MEDIUM
    # If True this group type should be released everywhere. If False, fall back to features to
    # decide if this is released. Add to HIDDEN_ISSUE_TYPES as well to prevent Events from this Group
    # being displayed on frontend.
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
    # Controls whether _all_ workflow notification types are enabled (e.g. assignment).
    # Useful when the group type is still in development
    enable_workflow_notifications = True

    # Controls whether users are able to manually update the group's priority.
    enable_user_status_and_priority_changes = True

    # Controls whether Seer automation is always triggered for this group type.
    always_trigger_seer_automation = False

    def __init_subclass__(cls: type[GroupType], **kwargs: Any) -> None:
        super().__init_subclass__(**kwargs)
        registry.add(cls)

        if not cls.released:
            for fname in cls.build_visible_feature_name():
                features.add(fname, OrganizationFeature, True, api_expose=True)
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
    def build_visible_feature_name(cls) -> list[str]:
        return [f"{cls.build_base_feature_name()}-visible"]

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


class ReplayGroupTypeDefaults:
    notification_config = NotificationConfig(context=[])


@dataclass(frozen=True)
class LLMDetectedExperimentalGroupType(GroupType):
    type_id = 3501
    slug = "llm_detected_experimental"
    description = "LLM Detected Issue"
    category = GroupCategory.AI_DETECTED.value
    category_v2 = GroupCategory.AI_DETECTED.value
    default_priority = PriorityLevel.MEDIUM
    released = False
    enable_auto_resolve = False
    enable_escalation_detection = False


@dataclass(frozen=True)
class LLMDetectedExperimentalGroupTypeV2(GroupType):
    type_id = 3502
    slug = "llm_detected_experimental_v2"
    description = "LLM Detected Issue"
    category = GroupCategory.AI_DETECTED.value
    category_v2 = GroupCategory.AI_DETECTED.value
    default_priority = PriorityLevel.MEDIUM
    released = False
    enable_auto_resolve = False
    enable_escalation_detection = False


@dataclass(frozen=True)
class ReplayRageClickType(ReplayGroupTypeDefaults, GroupType):
    type_id = 5002
    slug = "replay_click_rage"
    description = "Rage Click Detected"
    category = GroupCategory.REPLAY.value
    category_v2 = GroupCategory.FRONTEND.value
    default_priority = PriorityLevel.MEDIUM
    notification_config = NotificationConfig()
    released = True


@dataclass(frozen=True)
class ReplayHydrationErrorType(ReplayGroupTypeDefaults, GroupType):
    type_id = 5003
    slug = "replay_hydration_error"
    description = "Hydration Error Detected"
    category = GroupCategory.REPLAY.value
    category_v2 = GroupCategory.FRONTEND.value
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
        client.delete(key)
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
