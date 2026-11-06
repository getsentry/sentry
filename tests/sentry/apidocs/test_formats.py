import logging
from datetime import UTC, datetime, timedelta, timezone
from unittest import mock

import pytest

from sentry.apidocs.formats import absolute_url, iso_datetime


def test_iso_datetime_returns_isoformat() -> None:
    value = datetime(2024, 1, 2, 3, 4, 5, 678000, tzinfo=UTC)
    assert iso_datetime(value) == "2024-01-02T03:04:05.678000+00:00"


def test_iso_datetime_keeps_the_offset() -> None:
    value = datetime(2024, 1, 2, 3, 4, 5, tzinfo=timezone(timedelta(hours=2)))
    assert iso_datetime(value) == "2024-01-02T03:04:05+02:00"


def test_iso_datetime_rejects_naive_datetime() -> None:
    with pytest.raises(ValueError, match="no UTC offset"):
        iso_datetime(datetime(2024, 1, 2, 3, 4, 5))


@pytest.mark.parametrize(
    "url",
    [
        "https://sentry.io/organizations/org-slug/issues/1/",
        "http://localhost:8000/",
        "https://abc123:def456@o1.ingest.sentry.io/1",
        "https://sentry.io/api/1/csp-report/?sentry_key=abc123",
    ],
)
def test_absolute_url_accepts(url: str) -> None:
    assert absolute_url(url) == url


@pytest.mark.parametrize(
    "url", ["", "/organizations/org-slug/issues/1/", "sentry.io/issues/", "//sentry.io/"]
)
def test_absolute_url_rejects(url: str) -> None:
    with pytest.raises(ValueError, match="no scheme or host"):
        absolute_url(url)


def test_invalid_value_is_logged_outside_tests(caplog: pytest.LogCaptureFixture) -> None:
    with (
        mock.patch("sentry.apidocs.formats.in_test_environment", return_value=False),
        caplog.at_level(logging.WARNING, logger="sentry.apidocs.formats"),
    ):
        assert absolute_url("/relative/") == "/relative/"
        naive = datetime(2024, 1, 2, 3, 4, 5)
        assert iso_datetime(naive) == "2024-01-02T03:04:05"

    assert [(r.message, r.__dict__["format"], r.__dict__["problem"]) for r in caplog.records] == [
        ("apidocs.invalid_format", "uri", "the URL has no scheme or host"),
        ("apidocs.invalid_format", "date-time", "the datetime has no UTC offset"),
    ]
