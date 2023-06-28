from typing import Optional, Sequence, Union

from sentry.api.utils import InvalidParams
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.use_case_id_registry import REVERSE_METRIC_PATH_MAPPING, UseCaseID

#: Special integer used to represent a string missing from the indexer
STRING_NOT_FOUND = -1

#: Special integer returned by Snuba as tag value when a tag has not been set
TAG_NOT_SET = 0


class MetricIndexNotFound(InvalidParams):
    pass


def coerce_use_case_key(use_case: Union[UseCaseID, UseCaseKey]) -> UseCaseID:
    if isinstance(use_case, UseCaseKey):
        return REVERSE_METRIC_PATH_MAPPING[use_case]
    return use_case


def reverse_resolve_tag_value(
    use_case_id: Union[UseCaseID, UseCaseKey],
    org_id: int,
    index: Union[int, str, None],
    weak: bool = False,
) -> Optional[str]:
    use_case_id = coerce_use_case_key(use_case_id)
    if isinstance(index, str) or index is None:
        return index
    else:
        if weak:
            return reverse_resolve_weak(use_case_id, org_id, index)
        else:
            return reverse_resolve(use_case_id, org_id, index)


def reverse_resolve(use_case_id: Union[UseCaseID, UseCaseKey], org_id: int, index: int) -> str:
    assert index > 0
    use_case_id = coerce_use_case_key(use_case_id)
    resolved = indexer.reverse_resolve(use_case_id, org_id, index)
    # The indexer should never return None for integers > 0:
    if resolved is None:
        raise MetricIndexNotFound()

    return resolved


def reverse_resolve_weak(
    use_case_id: Union[UseCaseID, UseCaseKey], org_id: int, index: int
) -> Optional[str]:
    """
    Resolve an index value back to a string, special-casing 0 to return None.

    This is useful in situations where a `GROUP BY tags[123]` clause produces a
    tuple for metric buckets that are missing that tag, i.e. `tags[123] == 0`.
    """

    use_case_id = coerce_use_case_key(use_case_id)
    if index == TAG_NOT_SET:
        return None

    return reverse_resolve(use_case_id, org_id, index)


def resolve(
    use_case_id: Union[UseCaseID, UseCaseKey],
    org_id: int,
    string: str,
) -> int:
    use_case_id = coerce_use_case_key(use_case_id)
    resolved = indexer.resolve(use_case_id, org_id, string)
    if resolved is None:
        raise MetricIndexNotFound(f"Unknown string: {string!r}")

    return resolved


def resolve_tag_key(use_case_id: Union[UseCaseID, UseCaseKey], org_id: int, string: str) -> str:
    use_case_id = coerce_use_case_key(use_case_id)
    resolved = resolve(use_case_id, org_id, string)
    assert use_case_id in (UseCaseID.TRANSACTIONS, UseCaseID.SESSIONS)
    if use_case_id == UseCaseID.TRANSACTIONS:
        return f"tags_raw[{resolved}]"
    else:
        return f"tags[{resolved}]"


def resolve_tag_value(
    use_case_id: Union[UseCaseID, UseCaseKey], org_id: int, string: str
) -> Union[str, int]:
    use_case_id = coerce_use_case_key(use_case_id)
    assert isinstance(string, str)
    assert use_case_id in (UseCaseID.TRANSACTIONS, UseCaseID.SESSIONS)
    if use_case_id == UseCaseID.TRANSACTIONS:
        return string
    return resolve_weak(use_case_id, org_id, string)


def resolve_tag_values(
    use_case_id: Union[UseCaseID, UseCaseKey], org_id: int, strings: Sequence[str]
) -> Sequence[Union[str, int]]:
    use_case_id = coerce_use_case_key(use_case_id)
    rv = []
    for string in strings:
        resolved = resolve_tag_value(use_case_id, org_id, string)
        if resolved != STRING_NOT_FOUND:
            rv.append(resolved)

    return rv


def resolve_weak(use_case_id: Union[UseCaseID, UseCaseKey], org_id: int, string: str) -> int:
    """
    A version of `resolve` that returns -1 for missing values.

    When using `resolve_weak` to produce a WHERE-clause, it is quite
    useful to make the WHERE-clause "impossible" with `WHERE x = -1` instead of
    explicitly handling that exception.
    """
    use_case_id = coerce_use_case_key(use_case_id)
    resolved = indexer.resolve(use_case_id, org_id, string)
    if resolved is None:
        return STRING_NOT_FOUND

    return resolved


def resolve_many_weak(
    use_case_id: Union[UseCaseID, UseCaseKey], org_id: int, strings: Sequence[str]
) -> Sequence[int]:
    """
    Resolve multiple values at once, omitting missing ones. This is useful in
    the same way as `resolve_weak` is, e.g. `WHERE x in values`.
    """
    use_case_id = coerce_use_case_key(use_case_id)
    rv = []
    for string in strings:
        resolved = resolve_weak(use_case_id, org_id, string)
        if resolved != STRING_NOT_FOUND:
            rv.append(resolved)

    return rv
