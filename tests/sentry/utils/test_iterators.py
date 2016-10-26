from __future__ import absolute_import

from sentry.utils.iterators import chunked


def test_chunked():
    assert list(chunked(range(10), 4)) == [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
        [8, 9],
    ]
