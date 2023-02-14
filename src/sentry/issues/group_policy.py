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
    organizations: Optional[Dict[str, NoiseConfig]] = None
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
        if self.organizations:
            for organization, noise_config in self.organizations.items():
                if noise_config.ignore_limit > prev_limit:
                    prev_limit = noise_config.ignore_limit

        if self.early_access:
            if self.early_access.ignore_limit < prev_limit:
                raise ValueError(
                    "Early Access ignore limit must be lower than Limited Access organizations"
                )
            prev_limit = self.early_access.ignore_limit

        if self.default.ignore_limit < prev_limit:
            raise ValueError(
                "Default ignore limit must be lower than Early Access and Limited Access organization limits"
            )


def get_noise_config(group_policy: Type[GroupPolicy], organization: Organization) -> NoiseConfig:
    if group_policy.organizations and organization.id in group_policy.organizations.keys():
        return group_policy.organizations[organization.id]

    if organization.flags.early_adopter.is_set and group_policy.early_access:
        return group_policy.early_access

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

        if not should_create_group(client, new_grouphash, group_type, noise_config, project):
            groups_to_ignore.add(new_grouphash)

    new_grouphashes = new_grouphashes - groups_to_ignore
    return new_grouphashes


@metrics.wraps("performance.performance_issue.should_create_group", sample_rate=1.0)
def should_create_group(
    client: Any, grouphash: str, grouptype: GroupType, noise_config: NoiseConfig, project: Project
) -> bool:
    key = f"grouphash:{grouphash}:{project.id}"
    times_seen = client.incr(key)

    metrics.incr(
        "performance.performance_issue.grouphash_counted",
        tags={
            "times_seen": times_seen,
            "group_type": grouptype.slug,
        },
        sample_rate=1.0,
    )

    if times_seen >= noise_config.ignore_limit:
        client.delete(grouphash)
        metrics.incr(
            "performance.performance_issue.issue_will_be_created",
            tags={"group_type": grouptype.slug},
            sample_rate=1.0,
        )

        return True
    else:
        client.expire(key, noise_config.expiry_time)  # 24 hour expiration from last seen
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
