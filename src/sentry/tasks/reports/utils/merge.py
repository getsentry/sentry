import operator
from itertools import zip_longest


def merge_sequences(target, other, function=operator.add):
    """
    Merge two sequences into a single sequence. The length of the two
    sequences must be equal.
    """
    assert len(target) == len(other), "sequence lengths must match"

    rt_type = type(target)
    if rt_type == range:
        rt_type = list

    return rt_type([function(x, y) for x, y in zip(target, other)])


def merge_mappings(target, other, function=operator.add):
    """
    Merge two mappings into a single mapping. The set of keys in both
    mappings must be equal.
    """
    assert set(target) == set(other), "keys must match"
    return {k: function(v, other[k]) for k, v in target.items()}


def merge_series(target, other, function=operator.add):
    """
    Merge two series into a single series. Both series must have the same
    start and end points as well as the same resolution.
    """
    missing = object()
    results = []
    for x, y in zip_longest(target, other, fillvalue=missing):
        assert x is not missing and y is not missing, "series must be same length"
        assert x[0] == y[0], "series timestamps must match"
        results.append((x[0], function(x[1], y[1])))
    return results
