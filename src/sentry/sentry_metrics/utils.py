from typing import Optional, Sequence, Union

from sentry import options
from sentry.api.utils import InvalidParams
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.configuration import UseCaseKey

#: Special integer used to represent a string missing from the indexer
STRING_NOT_FOUND = -1

#: Special integer returned by Snuba as tag value when a tag has not been set
TAG_NOT_SET = 0


class MetricIndexNotFound(InvalidParams):
    pass


def reverse_resolve_tag_value(
    use_case_id: UseCaseKey, org_id: int, index: Union[int, str, None], weak: bool = False
) -> Optional[str]:
    # XXX(markus): Normally there would be a check for the option
    # "sentry-metrics.performance.tags-values-are-strings", but this function
    # is sometimes called with metric IDs for reasons I haven't figured out.
    if isinstance(index, str) or index is None:
        return index
    else:
        if weak:
            return reverse_resolve_weak(use_case_id, org_id, index)
        else:
            return reverse_resolve(use_case_id, org_id, index)


def reverse_resolve(use_case_id: UseCaseKey, org_id: int, index: int) -> str:
    assert index > 0
    resolved = indexer.reverse_resolve(use_case_id, org_id, index)
    # The indexer should never return None for integers > 0:
    if resolved is None:
        raise MetricIndexNotFound()

    return resolved


def reverse_resolve_weak(use_case_id: UseCaseKey, org_id: int, index: int) -> Optional[str]:
    """
    Resolve an index value back to a string, special-casing 0 to return None.

    This is useful in situations where a `GROUP BY tags[123]` clause produces a
    tuple for metric buckets that are missing that tag, i.e. `tags[123] == 0`.
    """

    if index == TAG_NOT_SET:
        return None

    return reverse_resolve(use_case_id, org_id, index)


def resolve(
    use_case_id: UseCaseKey,
    org_id: int,
    string: str,
) -> int:
    resolved = indexer.resolve(use_case_id, org_id, string)
    if resolved is None:
        raise MetricIndexNotFound(f"Unknown string: {string!r}")

    return resolved


def resolve_tag_key(use_case_id: UseCaseKey, org_id: int, string: str) -> str:
    resolved = resolve(use_case_id, org_id, string)
    assert use_case_id in (UseCaseKey.PERFORMANCE, UseCaseKey.RELEASE_HEALTH)
    if use_case_id == UseCaseKey.PERFORMANCE and options.get(
        "sentry-metrics.performance.tags-values-are-strings"
    ):
        return f"tags_raw[{resolved}]"
    else:
        return f"tags[{resolved}]"


def resolve_tag_value(use_case_id: UseCaseKey, org_id: int, string: str) -> Union[str, int]:
    assert isinstance(string, str)
    assert use_case_id in (UseCaseKey.PERFORMANCE, UseCaseKey.RELEASE_HEALTH)
    if use_case_id == UseCaseKey.PERFORMANCE and options.get(
        "sentry-metrics.performance.tags-values-are-strings"
    ):
        return string
    return resolve_weak(use_case_id, org_id, string)


def resolve_tag_values(
    use_case_id: UseCaseKey, org_id: int, strings: Sequence[str]
) -> Sequence[Union[str, int]]:
    rv = []
    for string in strings:
        resolved = resolve_tag_value(use_case_id, org_id, string)
        if resolved != STRING_NOT_FOUND:
            rv.append(resolved)

    return rv


def resolve_weak(use_case_id: UseCaseKey, org_id: int, string: str) -> int:
    """
    A version of `resolve` that returns -1 for missing values.

    When using `resolve_weak` to produce a WHERE-clause, it is quite
    useful to make the WHERE-clause "impossible" with `WHERE x = -1` instead of
    explicitly handling that exception.
    """
    resolved = indexer.resolve(use_case_id, org_id, string)
    if resolved is None:
        return STRING_NOT_FOUND

    return resolved


def resolve_many_weak(
    use_case_id: UseCaseKey, org_id: int, strings: Sequence[str]
) -> Sequence[int]:
    """
    Resolve multiple values at once, omitting missing ones. This is useful in
    the same way as `resolve_weak` is, e.g. `WHERE x in values`.
    """
    rv = []
    for string in strings:
        resolved = resolve_weak(use_case_id, org_id, string)
        if resolved != STRING_NOT_FOUND:
            rv.append(resolved)

    return rv
