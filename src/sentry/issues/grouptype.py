from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from enum import Enum
from typing import TYPE_CHECKING, Any, Dict, Optional, Set, Type

from django.conf import settings

from sentry import features
from sentry.models import Organization, Project
from sentry.utils import metrics, redis

if TYPE_CHECKING:
    from sentry.utils.performance_issues.performance_detection import PerformanceProblem


class GroupCategory(Enum):
    ERROR = 1
    PERFORMANCE = 2
    PROFILE = 3


GROUP_CATEGORIES_CUSTOM_EMAIL = (GroupCategory.ERROR, GroupCategory.PERFORMANCE)
# GroupCategories which have customized email templates. If not included here, will fall back to a generic template.

_group_type_registry: Dict[int, Type[GroupType]] = {}
_slug_lookup: Dict[str, Type[GroupType]] = {}
_category_lookup: Dict[int, Set[int]] = defaultdict(set)
DEFAULT_IGNORE_LIMIT: int = 3
DEFAULT_EXPIRY_TIME: int = 60 * 60 * 24


@dataclass(frozen=True)
class NoiseConfig:
    ignore_limit: int = DEFAULT_IGNORE_LIMIT
    expiry_time: int = DEFAULT_EXPIRY_TIME


@dataclass(frozen=True)
class GroupPolicy:
    feature: str  # should be in the format "organizations:name-of-feature"
    limited_access: Optional[NoiseConfig] = None
    early_access: Optional[NoiseConfig] = None
    general_access: NoiseConfig = NoiseConfig()


@dataclass(frozen=True)
class GroupType:
    type_id: int
    slug: str
    description: str
    category: int
    group_policy: Optional[Type[GroupPolicy]] = None

    def __init_subclass__(cls: Type[GroupType], **kwargs: Any) -> None:
        super().__init_subclass__(**kwargs)
        if _group_type_registry.get(cls.type_id):
            raise ValueError(
                f"A group type with the type_id {cls.type_id} has already been registered."
            )
        _group_type_registry[cls.type_id] = cls
        _slug_lookup[cls.slug] = cls
        _category_lookup[cls.category].add(cls.type_id)

    def __post_init__(self) -> None:
        valid_categories = [category.value for category in GroupCategory]
        if self.category not in valid_categories:
            raise ValueError(f"Category must be one of {valid_categories} from GroupCategory.")

        # ensure that noise config ignore limits only increase with rollouts
        # use a ratio of ignore limit to expiry time to allow for greater flexibility
        if self.group_policy:
            prev_ignore_limit_ratio = 0
            group_policy = self.group_policy
            if group_policy.limited_access:
                prev_ignore_limit_ratio = (
                    group_policy.limited_access.ignore_limit
                    / group_policy.limited_access.expiry_time
                )

            if group_policy.early_access:
                early_access_ratio = (
                    group_policy.early_access.ignore_limit / group_policy.limited_access.expiry_time
                )
                if early_access_ratio < prev_ignore_limit_ratio:
                    raise ValueError(
                        "Early Access ignore limit ratio must be greater than Limited Access ignore limit ratio"
                    )
                prev_ignore_limit_ratio = early_access_ratio

            general_access_ratio = (
                group_policy.general_access.ignore_limit / group_policy.general_access.expiry_time
            )
            if general_access_ratio < prev_ignore_limit_ratio:
                raise ValueError(
                    "General Access ignore limit must be greater than Early Access and Limited Access ignore limit ratios"
                )


def get_noise_config(
    grouptype: Type[GroupType], organization: Organization
) -> Optional[NoiseConfig]:
    group_policy = grouptype.group_policy
    if not group_policy:
        return None

    if features.has(group_policy.feature, organization, actor=None) and group_policy.limited_access:
        return group_policy.limited_access

    if organization.flags.early_adopter and group_policy.early_access:
        return group_policy.early_access

    return group_policy.general_access


def get_all_group_type_ids() -> Set[int]:
    return {type.type_id for type in _group_type_registry.values()}


def get_group_types_by_category(category: int) -> Set[int]:
    return _category_lookup[category]


def get_group_type_by_slug(slug: str) -> Type[GroupType]:
    if slug not in _slug_lookup:
        raise ValueError(f"No group type with the slug {slug} is registered.")
    return _slug_lookup[slug]


def get_group_type_by_type_id(id: int) -> Type[GroupType]:
    if id not in _group_type_registry:
        raise ValueError(f"No group type with the id {id} is registered.")
    return _group_type_registry[id]


@dataclass(frozen=True)
class ErrorGroupType(GroupType):
    type_id = 1
    slug = "error"
    description = "Error"
    category = GroupCategory.ERROR.value


@dataclass(frozen=True)
class PerformanceSlowDBQueryGroupType(GroupType):
    type_id = 1001
    slug = "performance_slow_db_query"
    description = "Slow DB Query"
    category = GroupCategory.PERFORMANCE.value
    group_policy = GroupPolicy(
        feature="organizations:performance-slow-db-issue",
        general_access=NoiseConfig(ignore_limit=100),
    )


@dataclass(frozen=True)
class PerformanceRenderBlockingAssetSpanGroupType(GroupType):
    type_id = 1004
    slug = "performance_render_blocking_asset_span"
    description = "Large Render Blocking Asset"
    category = GroupCategory.PERFORMANCE.value
    group_policy = GroupPolicy(
        feature="organizations:performance-issues-render-blocking-assets-detector"
    )


@dataclass(frozen=True)
class PerformanceNPlusOneGroupType(GroupType):
    type_id = 1006
    slug = "performance_n_plus_one_db_queries"
    description = "N+1 Query"
    category = GroupCategory.PERFORMANCE.value
    group_policy = GroupPolicy(feature="organizations:performance-issues-m-n-plus-one-db-detector")


@dataclass(frozen=True)
class PerformanceConsecutiveDBQueriesGroupType(GroupType):
    type_id = 1007
    slug = "performance_consecutive_db_queries"
    description = "Consecutive DB Queries"
    category = GroupCategory.PERFORMANCE.value
    group_policy = GroupPolicy(
        feature="organizations:performance-consecutive-db-issue",
        general_access=NoiseConfig(ignore_limit=15),
    )


@dataclass(frozen=True)
class PerformanceFileIOMainThreadGroupType(GroupType):
    type_id = 1008
    slug = "performance_file_io_main_thread"
    description = "File IO on Main Thread"
    category = GroupCategory.PERFORMANCE.value
    group_policy = GroupPolicy(feature="organizations:performance-file-io-main-thread-detector")


@dataclass(frozen=True)
class PerformanceNPlusOneAPICallsGroupType(GroupType):
    type_id = 1010
    slug = "performance_n_plus_one_api_calls"
    description = "N+1 API Call"
    category = GroupCategory.PERFORMANCE.value
    group_policy = GroupPolicy(feature="organizations:performance-n-plus-one-api-calls-detector")


@dataclass(frozen=True)
class PerformanceMNPlusOneDBQueriesGroupType(GroupType):
    type_id = 1011
    slug = "performance_m_n_plus_one_db_queries"
    description = "MN+1 Query"
    category = GroupCategory.PERFORMANCE.value
    group_policy = GroupPolicy(feature="organizations:performance-issues-m-n-plus-one-db-detector")


@dataclass(frozen=True)
class PerformanceUncompressedAssetsGroupType(GroupType):
    type_id = 1012
    slug = "performance_uncompressed_assets"
    description = "Uncompressed Asset"
    category = GroupCategory.PERFORMANCE.value
    group_policy = GroupPolicy(
        feature="organizations:performance-issues-compressed-assets-detector",
        general_access=NoiseConfig(ignore_limit=100),
    )


@dataclass(frozen=True)
class ProfileBlockedThreadGroupType(GroupType):
    type_id = 2000
    slug = "profile_blocked_thread"
    description = "Blocked Thread"
    category = GroupCategory.PROFILE.value


def reduce_noise(
    new_grouphashes: Set[str],
    performance_problems_by_hash: Dict[str, PerformanceProblem],
    project: Project,
) -> Set[str]:
    groups_to_ignore = set()
    cluster_key = settings.SENTRY_PERFORMANCE_ISSUES_RATE_LIMITER_OPTIONS.get("cluster", "default")
    client = redis.redis_clusters.get(cluster_key)

    for new_grouphash in new_grouphashes:
        group_type = performance_problems_by_hash[new_grouphash].type
        # group_policy = get_group_policy_by_type_id(group_type.type_id)
        # # use default policy if none exists
        # if not group_policy:
        #     noise_config = NoiseConfig()
        # else:
        noise_config = get_noise_config(group_type, project.organization)

        ignore_limit, expiry_time = noise_config.ignore_limit, noise_config.expiry_time

        if ignore_limit and not should_create_group(
            client, new_grouphash, group_type, ignore_limit, expiry_time, project
        ):
            groups_to_ignore.add(new_grouphash)

    new_grouphashes = new_grouphashes - groups_to_ignore
    return new_grouphashes


@metrics.wraps("group_policy.should_create_group", sample_rate=1.0)
def should_create_group(
    client: Any,
    grouphash: str,
    grouptype: GroupType,
    ignore_limit: int,
    expiry_time: int,
    project: Project,
) -> bool:
    key = f"grouphash:{grouphash}:{project.id}"
    times_seen = client.incr(key)

    over_threshold = times_seen >= ignore_limit

    # TODO also log access level of org

    metrics.incr(
        "group_policy.should_create_group.threshold",
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
        client.expire(key, expiry_time)
        return False
