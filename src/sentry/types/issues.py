from collections import defaultdict
from enum import Enum


class GroupType(Enum):
    # WARNING:
    # Currently all fingerprints are using the enum string instead of value,
    # DO NOT change the enum key string for any currently on detector or else
    # you will create duplicate issues for customers (until the fingerprints are fixed)
    ERROR = 1
    PERFORMANCE_SLOW_DB_QUERY = 1001
    PERFORMANCE_RENDER_BLOCKING_ASSET_SPAN = 1004
    PERFORMANCE_N_PLUS_ONE_DB_QUERIES = 1006
    PERFORMANCE_CONSECUTIVE_DB_QUERIES = 1007
    PERFORMANCE_FILE_IO_MAIN_THREAD = 1008
    PERFORMANCE_N_PLUS_ONE_API_CALLS = 1010
    PERFORMANCE_M_N_PLUS_ONE_DB_QUERIES = 1011
    PERFORMANCE_UNCOMPRESSED_ASSETS = 1012
    PROFILE_BLOCKED_THREAD = 2000


class GroupCategory(Enum):
    ERROR = 1
    PERFORMANCE = 2
    PROFILE = 3


GROUP_CATEGORIES_CUSTOM_EMAIL = (GroupCategory.ERROR, GroupCategory.PERFORMANCE)
# GroupCategories which have customized email templates. If not included here, will fall back to a generic template.

GROUP_TYPE_TO_CATEGORY = {
    GroupType.ERROR: GroupCategory.ERROR,
    GroupType.PERFORMANCE_CONSECUTIVE_DB_QUERIES: GroupCategory.PERFORMANCE,
    GroupType.PERFORMANCE_SLOW_DB_QUERY: GroupCategory.PERFORMANCE,
    GroupType.PERFORMANCE_RENDER_BLOCKING_ASSET_SPAN: GroupCategory.PERFORMANCE,
    GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES: GroupCategory.PERFORMANCE,
    GroupType.PERFORMANCE_FILE_IO_MAIN_THREAD: GroupCategory.PERFORMANCE,
    GroupType.PERFORMANCE_N_PLUS_ONE_API_CALLS: GroupCategory.PERFORMANCE,
    GroupType.PERFORMANCE_M_N_PLUS_ONE_DB_QUERIES: GroupCategory.PERFORMANCE,
    GroupType.PERFORMANCE_UNCOMPRESSED_ASSETS: GroupCategory.PERFORMANCE,
    GroupType.PROFILE_BLOCKED_THREAD: GroupCategory.PROFILE,
}

GROUP_TYPE_TO_TEXT = {
    GroupType.ERROR: "Error",
    GroupType.PERFORMANCE_CONSECUTIVE_DB_QUERIES: "Consecutive DB Queries",
    GroupType.PERFORMANCE_SLOW_DB_QUERY: "Slow DB Query",
    GroupType.PERFORMANCE_RENDER_BLOCKING_ASSET_SPAN: "Large Render Blocking Asset",
    GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES: "N+1 Query",
    GroupType.PERFORMANCE_FILE_IO_MAIN_THREAD: "File IO on Main Thread",
    GroupType.PERFORMANCE_N_PLUS_ONE_API_CALLS: "N+1 API Call",
    GroupType.PERFORMANCE_M_N_PLUS_ONE_DB_QUERIES: "MN+1 Query",
    GroupType.PERFORMANCE_UNCOMPRESSED_ASSETS: "Uncompressed Asset",
    GroupType.PROFILE_BLOCKED_THREAD: "Blocked Thread",
}


PERFORMANCE_TYPES = [
    gt.value for gt, gc in GROUP_TYPE_TO_CATEGORY.items() if gc == GroupCategory.PERFORMANCE
]

PROFILE_TYPES = [
    gt.value for gt, gc in GROUP_TYPE_TO_CATEGORY.items() if gc == GroupCategory.PROFILE
]


def get_category_type_mapping():
    category_type_mapping = defaultdict(list)

    for type, category in GROUP_TYPE_TO_CATEGORY.items():
        category_type_mapping[category].append(type)

    return category_type_mapping


GROUP_CATEGORY_TO_TYPES = get_category_type_mapping()
