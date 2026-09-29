from enum import Enum


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


def glob_star_match(pattern: str, value: str) -> bool:
    """
    Match value against a star-only glob pattern (case-insensitive).

    '*' matches zero or more of any character. Every other character,
    including '?' and '[', is treated as a literal for now.
    """
    pattern = pattern.lower()
    value = value.lower()
    # Split on '*' to get the literal segments that must appear in order.
    # e.g. "a*b*c" -> ["a", "b", "c"]
    parts = pattern.split("*")
    # No wildcard — require exact equality.
    if len(parts) == 1:
        return value == pattern
    # parts[0] is the prefix anchor; value must start with it.
    if not value.startswith(parts[0]):
        return False
    # parts[-1] is the suffix anchor; value must end with it (unless the
    # pattern ends with '*', in which case parts[-1] is "" and any suffix matches).
    if not value.endswith(parts[-1]) and parts[-1] != "":
        return False
    # Narrow the search window to exclude the already-matched prefix and suffix.
    end = len(value) - len(parts[-1]) if parts[-1] else len(value)
    start = len(parts[0])
    # The prefix and suffix anchors overlap, meaning the
    # value is shorter than prefix + suffix combined — no valid match possible.
    if start > end:
        return False
    # Walk the middle segments left-to-right, advancing the cursor after each hit
    # so that relative ordering is preserved.
    for part in parts[1:-1]:
        if not part:
            # Consecutive '*'s produce empty segments — nothing to match, skip.
            continue
        idx = value.find(part, start, end)
        if idx == -1:
            return False
        start = idx + len(part)
    return True
