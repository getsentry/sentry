"""
Reads a glob pattern the way Relay's ``relay-pattern`` crate parses it, before Sentry
sends it to Relay.

Relay ignores a pattern it cannot parse when it loads a generic filter, without an
error (a debug build panics instead), so a broken pattern silently matches nothing and
the filter drops less than the user wrote. Relay's bindings cannot catch this: they
validate a condition by parsing it the same lenient way.

Mirrors ``Parser`` in ``relay-pattern/src/lib.rs``, with one difference: Relay accepts a
``{`` that is never closed and ignores what follows it, which this rejects.
"""

from __future__ import annotations

# Relay sets no complexity limit on the patterns of a generic filter, and a pattern's
# matching work grows with its complexity.
MAX_GLOB_COMPLEXITY = 256


class InvalidGlobPattern(ValueError):
    pass


def glob_complexity(pattern: str) -> int:
    """
    How Relay counts the pattern's alternations: the product of the number of
    alternatives in each `{}` group, at least 1 once there is a group, and 0 without
    one. ``{a,b}/{c,d,e}`` has 6.

    Raises ``InvalidGlobPattern`` with a message for the user if Relay cannot parse the
    pattern.
    """
    complexity = 0
    # The number of alternatives in the open group so far, or None outside a group.
    alternatives: int | None = None

    i = 0
    while i < len(pattern):
        c = pattern[i]
        i += 1
        if c == "[":
            i = _skip_class(pattern, i)
        elif c == "]":
            raise InvalidGlobPattern("A `]` has no matching `[`. Escape it as `\\]`.")
        elif c == "{":
            if alternatives is not None:
                raise InvalidGlobPattern("A `{` group cannot contain another `{` group.")
            alternatives = 1
        elif c == "}":
            if alternatives is None:
                raise InvalidGlobPattern("A `}` has no matching `{`. Escape it as `\\}`.")
            complexity = max(complexity, 1) * alternatives
            alternatives = None
        elif c == "," and alternatives is not None:
            alternatives += 1
        elif c == "\\":
            if i == len(pattern):
                raise InvalidGlobPattern("The pattern ends with a `\\` that escapes nothing.")
            # The escaped character is a literal, whatever it is.
            i += 1

    if alternatives is not None:
        raise InvalidGlobPattern("A `{` has no matching `}`. Escape it as `\\{`.")

    return complexity


def _skip_class(pattern: str, i: int) -> int:
    """
    Reads the character class whose `[` comes right before ``pattern[i]``, and returns
    the index after its closing `]`.
    """
    if pattern[i : i + 1] == "!":
        i += 1

    # The start of the last range, which a `-` and the character after it end.
    start: str | None = None
    first = True
    in_range = False
    while True:
        if i == len(pattern):
            raise InvalidGlobPattern("A `[` has no matching `]`. Escape it as `\\[`.")
        c = pattern[i]
        i += 1
        if c == "[":
            raise InvalidGlobPattern("A `[` inside a character class must be escaped as `\\[`.")
        if c == "]":
            return i
        if c == "-" and not first and not in_range:
            in_range = True
        else:
            if c == "\\":
                if i == len(pattern):
                    raise InvalidGlobPattern("The pattern ends with a `\\` that escapes nothing.")
                c = pattern[i]
                i += 1
            if in_range:
                assert start is not None
                if start > c:
                    raise InvalidGlobPattern(
                        f"The range `{start}-{c}` is invalid: `{start}` comes after `{c}`."
                    )
                in_range = False
            else:
                start = c
        first = False
