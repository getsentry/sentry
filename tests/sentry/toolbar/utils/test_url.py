from sentry.toolbar.utils.url import url_matches

"""
TODO:
Hostname
- wildcard (y/n, n for startswith case)

Port
- not in target
- in target

Scheme
- not in target
- in target
"""


def test_url_matches_basic():
    test_cases = [
        ("http://abc.net", "http://abc.net", True),
        ("http://pocketpair.io", "http://sentry.io", False),
        ("http://sentry.io/issues", "http://sentry.io", True),
        ("http://sentry.io", "http://sentry.io/issues", True),
        ("https://cmu.edu", "https://cmu.com", False),
        ("https://youtube.com:443/watch?v=3xhb", "https://youtube.com/profile", True),
    ]
    for url, target_url, expected in test_cases:
        assert url_matches(url, target_url) == expected


# def test_url_matches_wildcard():
#     pass
