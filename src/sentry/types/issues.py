from collections import defaultdict
from enum import Enum


class GroupType(Enum):
    ERROR = 1
    PERFORMANCE_N_PLUS_ONE = 1000
    PERFORMANCE_SLOW_SPAN = 1001


class GroupCategory(Enum):
    ERROR = 1
    PERFORMANCE = 2


GROUP_TYPE_TO_CATEGORY = {
    GroupType.ERROR: GroupCategory.ERROR,
    GroupType.PERFORMANCE_N_PLUS_ONE: GroupCategory.PERFORMANCE,
    GroupType.PERFORMANCE_SLOW_SPAN: GroupCategory.PERFORMANCE,
}


def get_category_type_mapping():
    category_type_mapping = defaultdict(list)

    for type, category in GROUP_TYPE_TO_CATEGORY.items():
        category_type_mapping[category].append(type)

    return category_type_mapping


GROUP_CATEGORY_TO_TYPES = get_category_type_mapping()
