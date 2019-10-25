from __future__ import absolute_import

import pytest

from sentry.utils.urls import non_standard_url_join


@pytest.mark.parametrize(
    "base,to_join,expected",
    [
        ("http://example.com/foo", "bar", "http://example.com/bar"),
        ("http://example.com/foo", "/bar", "http://example.com/bar"),
        ("https://example.com/foo", "/bar", "https://example.com/bar"),
        ("aps://example.com/foo", "/bar", "aps://example.com/bar"),
        ("apsunknown://example.com/foo", "/bar", "apsunknown://example.com/bar"),
        ("apsunknown://example.com/foo", "//aha/uhu", "apsunknown://aha/uhu"),
    ],
)
def test_non_standard_url_join(base, to_join, expected):
    assert non_standard_url_join(base, to_join) == expected
