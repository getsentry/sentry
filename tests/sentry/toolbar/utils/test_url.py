from sentry.toolbar.utils.url import url_matches


class UrlMatchesTest:
    def __init__(self, test_cases):
        self.test_cases = test_cases

    def run(self):
        for url, target_url, expected in self.test_cases:
            assert url_matches(url, target_url) == expected


def test_url_matches_basic():
    UrlMatchesTest(
        [
            ("http://abc.net", "http://abc.net", True),
            ("http://pocketpair.io", "http://sentry.io", False),
            ("http://sentry.io/issues/", "http://sentry.io", True),
            ("http://sentry.io", "http://sentry.io/issues/", True),
            ("https://cmu.edu", "https://cmu.com", False),
            ("https://youtube.com:443/watch?v=3xhb", "https://youtube.com/profile", True),
        ]
    ).run()


def test_url_matches_wildcard():
    UrlMatchesTest(
        [
            ("https://nugettrends.sentry.io", "https://*.sentry.io", True),
            ("https://nugettrends.sentry.com", "https://*.sentry.io", False),
            ("https://nugettrends.sentry.io", "https://*.io", False),
            ("https://sentry.io", "https://*.sentry.io", False),
        ]
    ).run()


def test_url_matches_port():
    UrlMatchesTest(
        [
            ("https://sentry.io:42", "https://sentry.io:42", True),
            ("https://sentry.io", "https://sentry.io:42", False),
            ("https://sentry.io:42", "https://sentry.io", True),
        ]
    ).run()


def test_url_matches_scheme():
    UrlMatchesTest(
        [
            ("https://sentry.io", "sentry.io", True),
            ("http://sentry.io", "sentry.io", True),
            ("http://sentry.io", "https://sentry.io", False),
        ]
    ).run()
