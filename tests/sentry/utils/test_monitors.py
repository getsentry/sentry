from __future__ import absolute_import

from sentry.utils.monitors import get_api_root_from_dsn


def test_get_api_root_from_dsn_with_port():
    rv = get_api_root_from_dsn("https://apikey@sentry.io:8080")
    assert rv == "https://sentry.io:8080"


def test_get_api_root_from_dsn_without_port():
    rv = get_api_root_from_dsn("https://apikey@sentry.io")
    assert rv == "https://sentry.io"
