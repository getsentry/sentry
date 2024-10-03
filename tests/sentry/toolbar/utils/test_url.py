from sentry.toolbar.utils.url import url_matches


def test_url_matches_basic():
    assert url_matches("http://abc.net", "http://abc.net")
    assert not url_matches("http://pocketpair.io", "http://sentry.io")
    assert url_matches("http://sentry.io/issues/", "http://sentry.io")
    assert url_matches("http://sentry.io", "http://sentry.io/issues/")
    assert not url_matches("https://cmu.edu", "https://cmu.com")
    assert url_matches("https://youtube.com:443/watch?v=3xhb", "https://youtube.com/profile")


def test_url_matches_wildcard():
    assert url_matches("https://nugettrends.sentry.io", "https://*.sentry.io")
    assert not url_matches("https://nugettrends.sentry.com", "https://*.sentry.io")
    assert not url_matches("https://nugettrends.sentry.io", "https://*.io")
    assert not url_matches("https://sentry.io", "https://*.sentry.io")


def test_url_matches_port():
    assert url_matches("https://sentry.io:42", "https://sentry.io:42")
    assert not url_matches("https://sentry.io", "https://sentry.io:42")
    assert url_matches("https://sentry.io:42", "https://sentry.io")


def test_url_matches_scheme():
    assert url_matches("https://sentry.io", "sentry.io")
    assert url_matches("http://sentry.io", "sentry.io")
    assert not url_matches("http://sentry.io", "https://sentry.io")
