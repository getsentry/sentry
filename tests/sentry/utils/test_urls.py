from unittest import TestCase

import pytest

from sentry.utils.urls import (
    add_params_to_url,
    non_standard_url_join,
    urlsplit_best_effort,
)


@pytest.mark.parametrize(
    "base,to_join,expected",
    [
        ("http://example.com/foo", "bar", "http://example.com/bar"),
        ("http://example.com/foo", "/bar", "http://example.com/bar"),
        ("https://example.com/foo", "/bar", "https://example.com/bar"),
        ("http://example.com/foo/baz", "bar", "http://example.com/foo/bar"),
        ("http://example.com/foo/baz", "/bar", "http://example.com/bar"),
        ("aps://example.com/foo", "/bar", "aps://example.com/bar"),
        ("apsunknown://example.com/foo", "/bar", "apsunknown://example.com/bar"),
        ("apsunknown://example.com/foo", "//aha/uhu", "apsunknown://aha/uhu"),
    ],
)
def test_non_standard_url_join(base: str, to_join: str, expected: str) -> None:
    assert non_standard_url_join(base, to_join) == expected


class AddParamsToUrlTest(TestCase):
    def test_basic(self) -> None:
        url = "https://sentry.io?myparam=value#hash-param"
        new_url = add_params_to_url(url, {"new_param": "another"})
        assert new_url == "https://sentry.io?myparam=value&new_param=another#hash-param"


@pytest.mark.parametrize(
    ("s", "expected"),
    (
        pytest.param(
            "https://example.com:123/path?query",
            ("https", "example.com:123", "/path", "query"),
            id="normal, valid url",
        ),
        pytest.param(
            "https://[not-a-url/path?query",
            ("https", "[not-a-url", "/path", "query"),
            id="invalid url",
        ),
        pytest.param(
            "https://[ip]:3456/path",
            ("https", "[ip]:3456", "/path", ""),
            id="invalid url in python 3.11+",
        ),
    ),
)
def test_urlsplit_best_effort(s: str, expected: tuple[str, str, str, str]) -> None:
    assert urlsplit_best_effort(s) == expected
