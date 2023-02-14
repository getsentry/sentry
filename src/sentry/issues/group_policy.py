from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Dict, Optional, Set, Type

from django.conf import settings

import sentry.issues.grouptype as grouptype
from sentry.issues.grouptype import GroupType, get_group_type_by_type_id
from sentry.models import Organization, Project
from sentry.utils import metrics, redis

if TYPE_CHECKING:
    from sentry.utils.performance_issues.performance_detection import PerformanceProblem

_group_policy_registry: Dict[int, Type[GroupPolicy]] = {}
DEFAULT_IGNORE_LIMIT: int = 3
DEFAULT_EXPIRY_TIME: int = 60 * 60 * 24


@dataclass(frozen=True)
class NoiseConfig:
    ignore_limit: int = DEFAULT_IGNORE_LIMIT
    expiry_time: int = DEFAULT_EXPIRY_TIME


@dataclass(frozen=True)
class GroupPolicy:
    group_type_id: int
    limited_access: Optional[NoiseConfig] = None
    early_access: Optional[NoiseConfig] = None
    default: NoiseConfig = NoiseConfig()

    def __init_subclass__(cls: Type[GroupPolicy], **kwargs: Any) -> None:
        super().__init_subclass__(**kwargs)

        # will raise a ValueError if group type does not exist
        get_group_type_by_type_id(cls.group_type_id)

        if _group_policy_registry.get(cls.group_type_id):
            raise ValueError(
                f"A group policy for the group type {cls.group_type_id} has already been registered."
            )
        _group_policy_registry[cls.group_type_id] = cls

    def __post_init__(self) -> None:
        # ensure that ignore limits only increase with rollouts
        prev_limit = 0
        if self.limited_access:
            prev_limit = self.limited_access.ignore_limit

        if self.early_access:
            if self.early_access.ignore_limit < prev_limit:
                raise ValueError(
                    "Early Access ignore limit must be greater than Limited Access ignore limit"
                )
            prev_limit = self.early_access.ignore_limit

        if self.default.ignore_limit < prev_limit:
            raise ValueError(
                "Default ignore limit must be greater than Early Access and Limited Access ignore limits"
            )


def get_noise_config(group_policy: Type[GroupPolicy], organization: Organization) -> NoiseConfig:
    # TODO tie into limited access and early access org flags

    return group_policy.default


def get_group_policy_by_type_id(type_id: int) -> Type[GroupPolicy]:
    if type_id not in _group_policy_registry:
        raise ValueError(f"No group policy with the id {type_id} is registered.")
    return _group_policy_registry[type_id]


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
        group_policy = get_group_policy_by_type_id(group_type.type_id)
        # use default policy if none exists
        if not group_policy:
            noise_config = NoiseConfig()
        else:
            noise_config = get_noise_config(group_policy, project.organization)

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


@dataclass(frozen=True)
class ErrorPolicy(GroupPolicy):
    group_type_id = grouptype.ErrorGroupType.type_id
    default = NoiseConfig(
        ignore_limit=0,
    )


@dataclass(frozen=True)
class PerformanceSlowDBQueryGroupPolicy(GroupPolicy):
    group_type_id = grouptype.PerformanceSlowDBQueryGroupType.type_id
    default = NoiseConfig(
        ignore_limit=100,
    )


@dataclass(frozen=True)
class PerformanceNPlusOneGroupPolicy(GroupPolicy):
    group_type_id = grouptype.PerformanceNPlusOneGroupType.type_id


@dataclass(frozen=True)
class PerformanceConsecutiveDBQueriesGroupPolicy(GroupPolicy):
    group_type_id = grouptype.PerformanceConsecutiveDBQueriesGroupType.type_id
    default = NoiseConfig(
        ignore_limit=15,
    )


@dataclass(frozen=True)
class PerformanceUncompressedAssetsGroupPolicy(GroupPolicy):
    group_type_id = grouptype.PerformanceUncompressedAssetsGroupType.type_id
    default = NoiseConfig(
        ignore_limit=100,
    )
