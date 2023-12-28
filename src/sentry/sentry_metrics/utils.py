from typing import Collection, Dict, Mapping, Optional, Sequence, Set, Union, cast

from sentry.exceptions import InvalidParams
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.indexer.base import to_use_case_id
from sentry.sentry_metrics.use_case_id_registry import METRIC_PATH_MAPPING, UseCaseID

#: Special integer used to represent a string missing from the indexer
STRING_NOT_FOUND = -1

#: Special integer returned by Snuba as tag value when a tag has not been set
TAG_NOT_SET = 0


class MetricIndexNotFound(InvalidParams):
    pass


def string_to_use_case_id(value: str) -> UseCaseID:
    try:
        return UseCaseID(value)
    except ValueError:
        # param doesn't appear to be a UseCaseID try with the obsolete UseCaseKey
        # will raise ValueError if it fails
        return to_use_case_id(UseCaseKey(value))


def reverse_resolve_tag_value(
    use_case_id: Union[UseCaseID, UseCaseKey],
    org_id: int,
    index: Union[int, str, None],
    weak: bool = False,
) -> Optional[str]:
    use_case_id = to_use_case_id(use_case_id)
    if isinstance(index, str) or index is None:
        return index
    else:
        if weak:
            return reverse_resolve_weak(use_case_id, org_id, index)
        else:
            return reverse_resolve(use_case_id, org_id, index)


def bulk_reverse_resolve_tag_value(
    use_case_id: UseCaseID, org_id: int, values: Collection[Union[int, str, None]]
) -> Mapping[Union[int, str], str]:
    """
    Reverse resolves a mixture of indexes and strings in bulk

    if the element is already a string it maps it to itself
    if the element is None it ignores it
    if the element is a positive integer it tries to resolve it
    if the element is 0 or a negative number it ignores it

    The result is a dictionary that is a mixture of strings and ints mapped to the resolved string,
    which is either itself (in case of string keys) or the reverse_resolved string (in case of positive integers)

    Example:
        bulk_reverse_resolve_tag_value( UseCaseKey:PERFORMANCE, 1, [ -1, 0, 1, "some-string", "abc", 7, 33333])
    would return something like this ( presuming that no string was found for 33333 )
    {
        1: "tag-a",
        "some-string": "some-string",
        "abc": "abc",
        7: "tag-b",
    }

    """
    ret_val: Dict[Union[int, str], str] = {}

    indexes_to_resolve: Set[int] = set()
    for value in values:
        if isinstance(value, str):
            ret_val[value] = value  # we already have a string no need to reverse resolve it
        elif isinstance(value, int) and value > 0:  # resolve valid int, do nothing for None
            indexes_to_resolve.add(value)

    resolved_indexes = cast(
        Mapping[Union[int, str], str],
        indexer.bulk_reverse_resolve(use_case_id, org_id, indexes_to_resolve),
    )

    return {**ret_val, **resolved_indexes}


def reverse_resolve(use_case_id: Union[UseCaseID, UseCaseKey], org_id: int, index: int) -> str:
    assert index > 0
    use_case_id = to_use_case_id(use_case_id)
    resolved = indexer.reverse_resolve(use_case_id, org_id, index)
    # The indexer should never return None for integers > 0:
    if resolved is None:
        raise MetricIndexNotFound()

    return resolved


def bulk_reverse_resolve(
    use_case_id: UseCaseID, org_id: int, indexes: Collection[int]
) -> Mapping[int, str]:
    # de duplicate indexes
    indexes_to_resolve = set()
    for idx in indexes:
        if idx > 0:
            indexes_to_resolve.add(idx)

    return indexer.bulk_reverse_resolve(use_case_id, org_id, indexes_to_resolve)


def reverse_resolve_weak(
    use_case_id: Union[UseCaseID, UseCaseKey], org_id: int, index: int
) -> Optional[str]:
    """
    Resolve an index value back to a string, special-casing 0 to return None.

    This is useful in situations where a `GROUP BY tags[123]` clause produces a
    tuple for metric buckets that are missing that tag, i.e. `tags[123] == 0`.
    """

    use_case_id = to_use_case_id(use_case_id)
    if index == TAG_NOT_SET:
        return None

    return reverse_resolve(use_case_id, org_id, index)


def resolve(
    use_case_id: Union[UseCaseID, UseCaseKey],
    org_id: int,
    string: str,
) -> int:
    use_case_id = to_use_case_id(use_case_id)
    resolved = indexer.resolve(use_case_id, org_id, string)
    if resolved is None:
        raise MetricIndexNotFound(f"Unknown string: {string!r}")

    return resolved


def resolve_tag_key(use_case_id: Union[UseCaseID, UseCaseKey], org_id: int, string: str) -> str:
    use_case_id = to_use_case_id(use_case_id)
    resolved = resolve(use_case_id, org_id, string)
    assert isinstance(use_case_id, UseCaseID)
    if METRIC_PATH_MAPPING[use_case_id] is UseCaseKey.PERFORMANCE:
        return f"tags_raw[{resolved}]"
    else:
        return f"tags[{resolved}]"


def resolve_tag_value(
    use_case_id: Union[UseCaseID, UseCaseKey], org_id: int, string: str
) -> Union[str, int]:
    use_case_id = to_use_case_id(use_case_id)
    assert isinstance(string, str)
    assert isinstance(use_case_id, UseCaseID)
    if METRIC_PATH_MAPPING[use_case_id] is UseCaseKey.PERFORMANCE:
        return string
    return resolve_weak(use_case_id, org_id, string)


def resolve_tag_values(
    use_case_id: Union[UseCaseID, UseCaseKey], org_id: int, strings: Sequence[str]
) -> Sequence[Union[str, int]]:
    use_case_id = to_use_case_id(use_case_id)
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
    use_case_id = to_use_case_id(use_case_id)
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
    use_case_id = to_use_case_id(use_case_id)
    rv = []
    for string in strings:
        resolved = resolve_weak(use_case_id, org_id, string)
        if resolved != STRING_NOT_FOUND:
            rv.append(resolved)

    return rv
