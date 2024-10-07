from urllib.parse import urlparse

from sentry.toolbar.utils.url import is_origin_allowed, url_matches


def test_url_matches_basic():
    assert url_matches(urlparse("http://abc.net"), "http://abc.net")
    assert not url_matches(urlparse("http://pocketpair.io"), "http://sentry.io")
    assert url_matches(urlparse("http://sentry.io/issues/"), "http://sentry.io")
    assert url_matches(urlparse("http://sentry.io"), "http://sentry.io/issues/")
    assert not url_matches(urlparse("https://cmu.edu"), "https://cmu.com")
    assert url_matches(
        urlparse("https://youtube.com:443/watch?v=3xhb"), "https://youtube.com/profile"
    )


def test_url_matches_wildcard():
    assert url_matches(urlparse("https://nugettrends.sentry.io"), "https://*.sentry.io")
    assert not url_matches(urlparse("https://nugettrends.sentry.com"), "https://*.sentry.io")
    assert not url_matches(urlparse("https://nugettrends.sentry.io"), "https://*.io")
    assert not url_matches(urlparse("https://sentry.io"), "https://*.sentry.io")


def test_url_matches_port():
    assert url_matches(urlparse("https://sentry.io:42"), "https://sentry.io:42")
    assert not url_matches(urlparse("https://sentry.io"), "https://sentry.io:42")
    assert url_matches(urlparse("https://sentry.io:42"), "https://sentry.io")


def test_url_matches_scheme():
    assert url_matches(urlparse("https://sentry.io"), "sentry.io")
    assert url_matches(urlparse("http://sentry.io"), "sentry.io")
    assert not url_matches(urlparse("http://sentry.io"), "https://sentry.io")


def test_url_is_empty():
    assert not url_matches(urlparse(""), "sentry.io")


def test_is_origin_allowed_allows_some():
    assert is_origin_allowed("http://sentry.io", ["http://abc.net", "http://sentry.io"])


def test_is_origin_allowed_rejects_all():
    assert not is_origin_allowed("http://sentry.io", ["http://abc.net", "http://xyz.net"])


def test_is_origin_allowed_rejects_empty():
    assert not is_origin_allowed("", ["http://abc.net", "http://xyz.net"])


def test_is_origin_allowed_prepends_http():
    assert is_origin_allowed("sentry.io", ["http://abc.net", "http://sentry.io"])
