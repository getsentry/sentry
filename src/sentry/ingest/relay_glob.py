"""
Reads a glob pattern the way Relay's ``relay-pattern`` crate parses it, before Sentry
sends it to Relay.

Relay drops a pattern it cannot parse from a generic filter without an error, and a
debug build panics on one instead, so a broken pattern would silently match nothing.
Relay's bindings cannot catch this: they validate a condition by parsing it the same
lenient way.

Mirrors ``Parser`` in ``relay-pattern/src/lib.rs``, with one difference: Relay accepts a
``{`` that is never closed and ignores what follows it, which this rejects.
"""

from __future__ import annotations

from dataclasses import dataclass

# Relay sets no complexity limit on the patterns of a generic filter, and a pattern's
# matching work grows with its complexity.
MAX_GLOB_COMPLEXITY = 256

# A separator in a URL or route, which nearly every transaction name contains.
_UNSPECIFIC_LITERALS = frozenset("/")


class InvalidGlobPattern(ValueError):
    pass


@dataclass(frozen=True)
class GlobShape:
    """
    ``complexity`` is how Relay counts the pattern's alternations: the product of the
    number of alternatives in each group, at least 1 once there is a group, and 0
    without one. ``{a,b}/{c,d,e}`` has 6.

    ``specific`` is whether every string the pattern matches must contain a literal
    character other than ``/``. A pattern that is not specific, such as ``*``, ``?*``
    or ``*/*``, matches nearly every name.
    """

    complexity: int
    specific: bool


def parse_glob(pattern: str) -> GlobShape:
    """
    Raises ``InvalidGlobPattern`` with a message for the user if Relay cannot parse the
    pattern.
    """
    complexity = 0
    specific = False
    # Whether each alternative of the open group so far has a specific literal.
    alternates: list[bool] | None = None

    i = 0
    while i < len(pattern):
        c = pattern[i]
        i += 1
        if c in "?*":
            continue
        if c == "[":
            i = _skip_class(pattern, i)
        elif c == "]":
            raise InvalidGlobPattern("A `]` has no matching `[`. Escape it as `\\]`.")
        elif c == "{":
            if alternates is not None:
                raise InvalidGlobPattern("A `{` group cannot contain another `{` group.")
            alternates = [False]
        elif c == "}":
            if alternates is None:
                raise InvalidGlobPattern("A `}` has no matching `{`. Escape it as `\\}`.")
            complexity = max(complexity, 1) * len(alternates)
            # A group narrows the match only if each of its alternatives does.
            specific = specific or all(alternates)
            alternates = None
        elif c == "," and alternates is not None:
            alternates.append(False)
        else:
            if c == "\\":
                if i == len(pattern):
                    raise InvalidGlobPattern("The pattern ends with a `\\` that escapes nothing.")
                c = pattern[i]
                i += 1
            if c not in _UNSPECIFIC_LITERALS:
                if alternates is None:
                    specific = True
                else:
                    alternates[-1] = True

    if alternates is not None:
        raise InvalidGlobPattern("A `{` has no matching `}`. Escape it as `\\{`.")

    return GlobShape(complexity=complexity, specific=specific)


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
