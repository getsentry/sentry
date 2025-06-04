from collections.abc import Iterable
from enum import StrEnum
from typing import Any


class MatchType(StrEnum):
    CONTAINS = "co"
    ENDS_WITH = "ew"
    EQUAL = "eq"
    GREATER_OR_EQUAL = "gte"
    GREATER = "gt"
    IS_SET = "is"
    IS_IN = "in"
    LESS_OR_EQUAL = "lte"
    LESS = "lt"
    NOT_CONTAINS = "nc"
    NOT_ENDS_WITH = "new"
    NOT_EQUAL = "ne"
    NOT_SET = "ns"
    NOT_STARTS_WITH = "nsw"
    NOT_IN = "nin"
    STARTS_WITH = "sw"


LEVEL_MATCH_CHOICES = {
    MatchType.EQUAL: "equal to",
    MatchType.GREATER_OR_EQUAL: "greater than or equal to",
    MatchType.LESS_OR_EQUAL: "less than or equal to",
}

RELEASE_MATCH_CHOICES = {
    MatchType.EQUAL: "equal to",
    MatchType.GREATER: "greater than",
    MatchType.LESS: "less than",
}

MATCH_CHOICES = {
    MatchType.CONTAINS: "contains",
    MatchType.ENDS_WITH: "ends with",
    MatchType.EQUAL: "equals",
    MatchType.IS_SET: "is set",
    MatchType.IS_IN: "is in (comma separated)",
    MatchType.NOT_CONTAINS: "does not contain",
    MatchType.NOT_ENDS_WITH: "does not end with",
    MatchType.NOT_EQUAL: "does not equal",
    MatchType.NOT_SET: "is not set",
    MatchType.NOT_STARTS_WITH: "does not start with",
    MatchType.NOT_IN: "not in (comma separated)",
    MatchType.STARTS_WITH: "starts with",
}


def match_values(group_values: Iterable[Any], match_value: str, match_type: str) -> bool:
    if match_type == MatchType.EQUAL:
        group_values_set = set(group_values)
        return match_value in group_values_set

    elif match_type == MatchType.NOT_EQUAL:
        group_values_set = set(group_values)
        return match_value not in group_values_set

    elif match_type == MatchType.STARTS_WITH:
        for g_value in group_values:
            if g_value.startswith(match_value):
                return True
        return False

    elif match_type == MatchType.NOT_STARTS_WITH:
        for g_value in group_values:
            if g_value.startswith(match_value):
                return False
        return True

    elif match_type == MatchType.ENDS_WITH:
        for g_value in group_values:
            if g_value.endswith(match_value):
                return True
        return False

    elif match_type == MatchType.NOT_ENDS_WITH:
        for g_value in group_values:
            if g_value.endswith(match_value):
                return False
        return True

    elif match_type == MatchType.CONTAINS:
        group_values_set = set(group_values)
        return any(match_value in g_value for g_value in group_values_set)

    elif match_type == MatchType.NOT_CONTAINS:
        group_values_set = set(group_values)
        return not any(match_value in g_value for g_value in group_values_set)

    elif match_type == MatchType.IS_IN:
        values_set = set(match_value.replace(" ", "").split(","))
        return any(g_value in values_set for g_value in group_values)

    elif match_type == MatchType.NOT_IN:
        values_set = set(match_value.replace(" ", "").split(","))
        return not any(g_value in values_set for g_value in group_values)

    raise RuntimeError("Invalid Match")
