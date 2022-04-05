from typing import Optional, Sequence

from sentry.api.utils import InvalidParams
from sentry.sentry_metrics import indexer

#: Special integer used to represent a string missing from the indexer
STRING_NOT_FOUND = -1

#: Special integer returned by Snuba as tag value when a tag has not been set
TAG_NOT_SET = 0


class MetricIndexNotFound(InvalidParams):  # type: ignore
    pass


def reverse_resolve(index: int) -> str:
    assert index > 0
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

    if index == TAG_NOT_SET:
        return None

    return reverse_resolve(index)


def resolve(org_id: int, string: str) -> int:
    resolved = indexer.resolve(org_id, string)
    if resolved is None:
        raise MetricIndexNotFound(f"Unknown string: {string!r}")

    return resolved  # type: ignore


def resolve_tag_key(org_id: int, string: str) -> str:
    resolved = resolve(org_id, string)
    return f"tags[{resolved}]"


def resolve_weak(org_id: int, string: str) -> int:
    """
    A version of `resolve` that returns -1 for missing values.

    When using `resolve_weak` to produce a WHERE-clause, it is quite
    useful to make the WHERE-clause "impossible" with `WHERE x = -1` instead of
    explicitly handling that exception.
    """
    resolved = indexer.resolve(org_id, string)
    if resolved is None:
        return STRING_NOT_FOUND

    return resolved  # type: ignore


def resolve_many_weak(org_id: int, strings: Sequence[str]) -> Sequence[int]:
    """
    Resolve multiple values at once, omitting missing ones. This is useful in
    the same way as `resolve_weak` is, e.g. `WHERE x in values`.
    """
    rv = []
    for string in strings:
        resolved = resolve_weak(org_id, string)
        if resolved != STRING_NOT_FOUND:
            rv.append(resolved)

    return rv
