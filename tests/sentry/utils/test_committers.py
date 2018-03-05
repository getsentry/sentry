from __future__ import absolute_import

from sentry.utils.committers import score_path_match_length


def test_score_path_match_length():
    assert score_path_match_length('foo/bar/baz', 'foo/bar/baz') == 3
    assert score_path_match_length('foo/bar/baz', 'bar/baz') == 2
    assert score_path_match_length('foo/bar/baz', 'baz') == 1
    assert score_path_match_length('foo/bar/baz', 'foo') == 0
    assert score_path_match_length('./foo/bar/baz', 'foo/bar/baz') == 3
