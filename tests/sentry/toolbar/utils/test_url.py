from urllib.parse import urlparse

import pytest

from sentry.toolbar.utils.url import is_origin_allowed, url_matches


@pytest.mark.parametrize(
    "referrer,target",
    [
        ("http://example.com", "http://example.com"),
        ("http://example.com", "://example.com"),
        ("https://example.com", "://example.com"),
        ("http://example.com", "example.com"),
        ("https://example.com", "example.com"),
    ],
)
def test_url_matches_scheme(referrer, target):
    assert url_matches(urlparse(referrer), target)


@pytest.mark.parametrize(
    "referrer,target",
    [
        ("http://example.com", "https://example.com"),
        ("https://example.com", "http://example.com"),
    ],
)
def test_url_matches_rejects_mispatched_scheme(referrer, target):
    assert not url_matches(urlparse(referrer), target)


@pytest.mark.parametrize(
    "referrer,target",
    [
        ("http://example.com", "example.com"),
        ("http://example.org", "example.org"),
        ("http://foo.example.com", "foo.example.com"),
        ("http://foo.example.com", "*.example.com"),
        ("http://foo.example.com", ".example.com"),
        ("http://foo.bar.example.com", "foo.bar.example.com"),
        ("http://foo.bar.example.com", "*.bar.example.com"),
        ("http://foo.bar.example.com", ".bar.example.com"),
    ],
)
def test_url_matches_hostname(referrer, target):
    assert url_matches(urlparse(referrer), target)


@pytest.mark.parametrize(
    "referrer,target",
    [
        ("http://example.com", "sentry.com"),
        ("http://example.com", "sentry.org"),
        ("http://foo.example.com", "other.example.com"),
        ("http://foo.example.com", "*.foo.example.com"),
        ("http://foo.example.com", ".foo.example.com"),
        ("http://foo.bar.example.com", "*.example.com"),
        ("http://foo.bar.example.com", ".example.com"),
        ("http://foo.bar.example.com", "*.foo.bar.example.com"),
        ("http://foo.bar.example.com", ".foo.bar.example.com"),
        ("http://example.com", "http://:80/path?query=foo"),
        ("http://example.com", "http://:80/path"),
        ("http://example.com", "http://:80/"),
        ("http://example.com", "http://:80"),
        ("http://example.com", "http:///?query=foo"),
        ("http://example.com", "http:///"),
        ("http://example.com", "http://?query=foo"),
        ("http://example.com", "http://"),
        ("http://example.com", ":80/?query=foo"),
        ("http://example.com", ":80?query=foo"),
        ("http://example.com", ":80"),
    ],
)
def test_url_matches_rejects_mismatched_hostname(referrer, target):
    assert not url_matches(urlparse(referrer), target)


@pytest.mark.parametrize(
    "referrer,target",
    [
        ("http://example.com:80", "http://example.com:80"),
        ("http://example.com:80", "http://example.com"),
        ("http://example.com:80", "example.com:80"),
        ("http://example.com:80", "example.com"),
        ("http://example.com", "http://example.com:80"),
        ("http://example.com", "http://example.com"),
        ("http://example.com", "example.com:80"),
        ("http://example.com", "example.com"),
        ("http://example.com:1234", "http://example.com:1234"),
        ("https://example.com:443", "https://example.com"),
        ("https://example.com", "https://example.com:443"),
        ("https://example.com", "example.com:443"),
        ("https://example.com", "https://example.com"),
        ("https://example.com:443", "example.com"),
        ("https://example.com", "example.com"),
        ("https://example.com:1234", "https://example.com:1234"),
    ],
)
def test_url_matches_port(referrer, target):
    assert url_matches(urlparse(referrer), target)


@pytest.mark.parametrize(
    "referrer,target",
    [
        ("http://example.com:80", "http://example.com:8000"),
        ("http://example.com", "https://example.com:80"),
        ("https://example.com", "http://example.com:443"),
        ("http://example.com", "https://example.com:1234"),
        ("https://example.com", "http://example.com:1234"),
        ("http://example.com", "http://example.com:abc"),
        ("http://example.com:80", "example.com:8000"),
        ("http://example.com", "example.com:1234"),
        ("https://example.com", "example.com:1234"),
        ("http://example.com", "example.com:abc"),
    ],
)
def test_url_matches_reject_mismatched_port(referrer, target):
    assert not url_matches(urlparse(referrer), target)


@pytest.mark.parametrize(
    "referrer,target",
    [
        ("http://example.com", "http://example.com:80/path"),
        ("http://example.com", "http://example.com:80/"),
        ("http://example.com", "http://example.com:80"),
        ("http://example.com", "http://example.com/path"),
        ("http://example.com", "http://example.com/"),
        ("http://example.com", "http://example.com:80/path?query=foo"),
        ("http://example.com", "http://example.com:80/?query=foo"),
        ("http://example.com", "http://example.com:80?query=foo"),
        ("http://example.com", "http://example.com/path?query=foo"),
        ("http://example.com", "http://example.com/?query=foo"),
        ("http://example.com", "http://example.com?query=foo"),
    ],
)
def test_url_matches_with_path_or_query(referrer, target):
    assert url_matches(urlparse(referrer), target)


def test_is_origin_allowed_allows_some():
    assert is_origin_allowed("http://sentry.io", ["http://abc.net", "http://sentry.io"])
    assert is_origin_allowed("http://localhost:5173/", ["localhost:5173"])


def test_is_origin_allowed_rejects_all():
    assert not is_origin_allowed("http://sentry.io", ["http://abc.net", "http://xyz.net"])


def test_is_origin_allowed_rejects_empty():
    assert not is_origin_allowed("", ["http://abc.net", "http://xyz.net"])


def test_is_origin_allowed_rejects_bad_input_scheme():
    assert not is_origin_allowed("sentry.io", ["sentry.io"])
    assert not is_origin_allowed("ftp://sentry.io", ["sentry.io"])
