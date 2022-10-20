from collections import defaultdict
from enum import Enum


class GroupType(Enum):
    ERROR = 1
    PERFORMANCE_N_PLUS_ONE = 1000
    PERFORMANCE_SLOW_SPAN = 1001
    PERFORMANCE_SEQUENTIAL_SLOW_SPANS = 1002
    PERFORMANCE_LONG_TASK_SPANS = 1003
    PERFORMANCE_RENDER_BLOCKING_ASSET_SPAN = 1004
    PERFORMANCE_DUPLICATE_SPANS = 1005
    PERFORMANCE_N_PLUS_ONE_DB_QUERIES = 1006


class GroupCategory(Enum):
    ERROR = 1
    PERFORMANCE = 2


GROUP_TYPE_TO_CATEGORY = {
    GroupType.ERROR: GroupCategory.ERROR,
    GroupType.PERFORMANCE_N_PLUS_ONE: GroupCategory.PERFORMANCE,
    GroupType.PERFORMANCE_SLOW_SPAN: GroupCategory.PERFORMANCE,
    GroupType.PERFORMANCE_SEQUENTIAL_SLOW_SPANS: GroupCategory.PERFORMANCE,
    GroupType.PERFORMANCE_LONG_TASK_SPANS: GroupCategory.PERFORMANCE,
    GroupType.PERFORMANCE_RENDER_BLOCKING_ASSET_SPAN: GroupCategory.PERFORMANCE,
    GroupType.PERFORMANCE_DUPLICATE_SPANS: GroupCategory.PERFORMANCE,
    GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES: GroupCategory.PERFORMANCE,
}

GROUP_TYPE_TO_TEXT = {
    GroupType.ERROR: "Error",
    GroupType.PERFORMANCE_N_PLUS_ONE: "N+1",  # may be N+1 Spans, N+1 Web Requests
    GroupType.PERFORMANCE_SLOW_SPAN: "Slow Span",
    GroupType.PERFORMANCE_SEQUENTIAL_SLOW_SPANS: "Sequential Slow Spans",
    GroupType.PERFORMANCE_LONG_TASK_SPANS: "Long Task Spans",
    GroupType.PERFORMANCE_RENDER_BLOCKING_ASSET_SPAN: "Render Blocking Asset Span",
    GroupType.PERFORMANCE_DUPLICATE_SPANS: "Duplicate Spans",
    GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES: "N+1 Query",
}


def get_category_type_mapping():
    category_type_mapping = defaultdict(list)

    for type, category in GROUP_TYPE_TO_CATEGORY.items():
        category_type_mapping[category].append(type)

    return category_type_mapping


GROUP_CATEGORY_TO_TYPES = get_category_type_mapping()
