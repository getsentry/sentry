from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, Set, Type


class GroupCategory(Enum):
    ERROR = 1
    PERFORMANCE = 2
    PROFILE = 3


GROUP_CATEGORIES_CUSTOM_EMAIL = (GroupCategory.ERROR, GroupCategory.PERFORMANCE)
# GroupCategories which have customized email templates. If not included here, will fall back to a generic template.

_group_type_registry: Dict[int, Type[GroupType]] = {}
_slug_lookup: Dict[str, Type[GroupType]] = {}
_category_lookup: Dict[int, Set[int]] = defaultdict(set)


@dataclass(frozen=True)
class GroupType:
    type_id: int
    slug: str
    description: str
    category: int
    ignore_limit: int = 3

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
    ignore_limit = 0


@dataclass(frozen=True)
class PerformanceSlowDBQueryGroupType(GroupType):
    type_id = 1001
    slug = "performance_slow_db_query"
    description = "Slow DB Query"
    category = GroupCategory.PERFORMANCE.value
    ignore_limit = 100


@dataclass(frozen=True)
class PerformanceRenderBlockingAssetSpanGroupType(GroupType):
    type_id = 1004
    slug = "performance_render_blocking_asset_span"
    description = "Large Render Blocking Asset"
    category = GroupCategory.PERFORMANCE.value


@dataclass(frozen=True)
class PerformanceNPlusOneGroupType(GroupType):
    type_id = 1006
    slug = "performance_n_plus_one_db_queries"
    description = "N+1 Query"
    category = GroupCategory.PERFORMANCE.value


@dataclass(frozen=True)
class PerformanceConsecutiveDBQueriesGroupType(GroupType):
    type_id = 1007
    slug = "performance_consecutive_db_queries"
    description = "Consecutive DB Queries"
    category = GroupCategory.PERFORMANCE.value
    ignore_limit = 15


@dataclass(frozen=True)
class PerformanceFileIOMainThreadGroupType(GroupType):
    type_id = 1008
    slug = "performance_file_io_main_thread"
    description = "File IO on Main Thread"
    category = GroupCategory.PERFORMANCE.value


@dataclass(frozen=True)
class PerformanceNPlusOneAPICallsGroupType(GroupType):
    type_id = 1010
    slug = "performance_n_plus_one_api_calls"
    description = "N+1 API Call"
    category = GroupCategory.PERFORMANCE.value


@dataclass(frozen=True)
class PerformanceMNPlusOneDBQueriesGroupType(GroupType):
    type_id = 1011
    slug = "performance_m_n_plus_one_db_queries"
    description = "MN+1 Query"
    category = GroupCategory.PERFORMANCE.value


@dataclass(frozen=True)
class PerformanceUncompressedAssetsGroupType(GroupType):
    type_id = 1012
    slug = "performance_uncompressed_assets"
    description = "Uncompressed Asset"
    category = GroupCategory.PERFORMANCE.value
    ignore_limit = 100


@dataclass(frozen=True)
class ProfileBlockedThreadGroupType(GroupType):
    type_id = 2000
    slug = "profile_blocked_thread"
    description = "Blocked Thread"
    category = GroupCategory.PROFILE.value
