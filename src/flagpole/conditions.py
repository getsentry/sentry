from enum import Enum

from sentry.utils.glob import glob_star_match


class ConditionOperatorKind(str, Enum):
    IN = "in"
    """
    Provided a list of values, check if the property value is in the list of values.

    When the property is itself a list, the condition matches if any of its
    entries appears in the list of values.
    """

    NOT_IN = "not_in"
    """
    The negation of IN: true when the property value is absent from the list of
    values. A list-valued property must have no entry in common with it.
    """

    CONTAINS = "contains"
    """Provided a single value, check if the property (a list) is included"""

    NOT_CONTAINS = "not_contains"
    """Provided a single value, check if the property (a list) is not included"""

    EQUALS = "equals"
    """Compare a value to another. Values are compared with types"""

    NOT_EQUALS = "not_equals"
    """Compare a value to not be equal to another. Values are compared with types"""

    MATCHES = "matches"
    """
    Provided a list of patterns, check if the property value matches any pattern.
    """

    NOT_MATCHES = "not_matches"
    """
    Provided a list of patterns, check if the property value matches none of the patterns.
    """


__all__ = ["ConditionOperatorKind", "glob_star_match"]
