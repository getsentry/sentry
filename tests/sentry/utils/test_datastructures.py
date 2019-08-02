from __future__ import absolute_import

import pytest

from sentry.utils.datastructures import BidirectionalMapping


def test_bidirectional_mapping():
    value = BidirectionalMapping({"a": 1, "b": 2})

    assert value["a"] == 1
    assert value["b"] == 2
    assert value.get_key(1) == "a"
    assert value.get_key(2) == "b"
    assert value.inverse() == {1: "a", 2: "b"}

    value["c"] = 3
    assert value["c"] == 3
    assert value.get_key(3) == "c"

    with pytest.raises(KeyError):
        value["d"]

    with pytest.raises(KeyError):
        value.get_key(4)

    with pytest.raises(TypeError):
        value["d"] = [1, 2, 3]  # not hashable

    assert len(value) == len(value.inverse()) == 3

    del value["c"]

    assert len(value) == len(value.inverse()) == 2
