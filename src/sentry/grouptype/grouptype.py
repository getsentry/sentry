from dataclasses import dataclass

from sentry.event_manager import DEFAULT_GROUPHASH_IGNORE_LIMIT
from sentry.types.issues import GroupCategory

_group_type_registry = {}


@dataclass(frozen=True)
class GroupType:
    type_id: int
    slug: str
    description: str
    category: int
    ignore_limit: int = DEFAULT_GROUPHASH_IGNORE_LIMIT

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        _group_type_registry[cls.__name__] = cls

    def __post_init__(self):
        valid_categories = [category.value for category in GroupCategory]
        if self.category not in valid_categories:
            raise ValueError(f"Category must be one of {valid_categories} from GroupCategory.")


def get_group_types_by_category(category):
    return [child.type_id for child in GroupType.__subclasses__() if child.category == category]


@dataclass(frozen=True)
class ErrorGroupType(GroupType):
    type_id = 1
    slug = "error"
    description = "Error"
    category = GroupCategory.ERROR.value
    ignore_limit = 0


@dataclass(frozen=True)
class SlowDBQueryGroupType(GroupType):
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


@dataclass(frozen=True)
class ProfileBlockedThreadGroupType(GroupType):
    type_id = 2000
    slug = "profile_blocked_thread"
    description = "Blocked Thread"
    category = GroupCategory.PROFILE.value
