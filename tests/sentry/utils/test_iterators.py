from __future__ import absolute_import

from sentry.utils.iterators import chunked, lookahead


def test_chunked():
    assert list(chunked(range(5), 5)) == [
        [0, 1, 2, 3, 4],
    ]

    assert list(chunked(range(10), 4)) == [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
        [8, 9],
    ]


def test_lookahead():
    assert list(lookahead(range(0))) == []
    assert list(lookahead(range(1))) == [(0, None)]
    assert list(lookahead(range(3))) == [
        (0, 1),
        (1, 2),
        (2, None),
    ]
