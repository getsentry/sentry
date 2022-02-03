from typing import Optional, Sequence

from sentry.api.utils import InvalidParams
from sentry.sentry_metrics import indexer


class MetricIndexNotFound(InvalidParams):  # type: ignore
    pass


def reverse_resolve(index: int) -> str:
    assert index != 0
    resolved = indexer.reverse_resolve(index)
    # The indexer should never return None for integers > 0:
    if resolved is None:
        raise MetricIndexNotFound()

    return resolved  # type: ignore


def reverse_resolve_weak(index: int) -> Optional[str]:
    """
    Resolve an index value back to a string, special-casing 0 to return None.

    This is useful in situations where a `GROUP BY tags[123]` clause produces a
    tuple for metric buckets that are missing that tag, i.e. `tags[123] == 0`.
    """

    if index == 0:
        return None

    return reverse_resolve(index)


def resolve(string: str) -> int:
    resolved = indexer.resolve(string)
    if resolved is None:
        raise MetricIndexNotFound(f"Unknown string: {string!r}")

    return resolved  # type: ignore


def resolve_tag_key(string: str) -> str:
    resolved = resolve(string)
    return f"tags[{resolved}]"


def resolve_weak(string: str) -> int:
    """
    A version of `resolve` that returns 0 for missing values.

    When using `resolve_weak` to produce a WHERE-clause, it is quite
    useful to make the WHERE-clause "impossible" with `WHERE x = 0` instead of
    explicitly handling that exception.
    """
    resolved = indexer.resolve(string)
    if resolved is None:
        return 0

    return resolved  # type: ignore


def resolve_many_weak(strings: Sequence[str]) -> Sequence[int]:
    """
    Resolve multiple values at once, omitting missing ones. This is useful in
    the same way as `resolve_weak` is, e.g. `WHERE x in values`.
    """
    rv = []
    for string in strings:
        resolved = resolve_weak(string)
        if resolved != 0:
            rv.append(resolved)

    return rv
