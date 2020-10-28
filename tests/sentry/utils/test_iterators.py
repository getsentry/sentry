from __future__ import absolute_import

import pytest

from sentry.utils.iterators import advance, chunked, shingle
from six.moves import xrange


def test_chunked():
    assert list(chunked(range(5), 5)) == [[0, 1, 2, 3, 4]]

    assert list(chunked(range(10), 4)) == [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9]]


def test_advance():
    i = iter(xrange(10))

    advance(5, i)  # [0, 1, 2, 3, 4]
    assert next(i) == 5

    advance(10, i)  # don't raise if slicing past end of iterator
    with pytest.raises(StopIteration):
        next(i)


def test_shingle():
    assert list(shingle(5, "x")) == []
    assert list(shingle(2, ("foo", "bar", "baz"))) == [("foo", "bar"), ("bar", "baz")]
