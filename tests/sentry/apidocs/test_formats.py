import logging
import uuid
from datetime import UTC, datetime, timedelta, timezone
from unittest import mock

import pytest

from sentry.apidocs.formats import (
    absolute_url,
    email_address,
    hex_id,
    iso_datetime,
    numeric_id,
    slug,
    uuid_str,
)


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


def test_uuid_str_formats_a_uuid() -> None:
    value = uuid.UUID("6a2c8b1e-5d4f-4c3b-9a8e-7f6d5c4b3a21")
    assert uuid_str(value) == "6a2c8b1e-5d4f-4c3b-9a8e-7f6d5c4b3a21"


@pytest.mark.parametrize(
    "value", ["6a2c8b1e-5d4f-4c3b-9a8e-7f6d5c4b3a21", "6A2C8B1E-5D4F-4C3B-9A8E-7F6D5C4B3A21"]
)
def test_uuid_str_accepts(value: str) -> None:
    assert uuid_str(value) == value


@pytest.mark.parametrize(
    "value", ["", "6a2c8b1e5d4f4c3b9a8e7f6d5c4b3a21", "6a2c8b1e-5d4f-4c3b-9a8e-7f6d5c4b3a21\n"]
)
def test_uuid_str_rejects(value: str) -> None:
    with pytest.raises(ValueError, match="hyphenated UUID"):
        uuid_str(value)


def test_hex_id_accepts() -> None:
    assert hex_id("9fac2ceed9344f2bbfdd1fdacb0ed9b1") == "9fac2ceed9344f2bbfdd1fdacb0ed9b1"


@pytest.mark.parametrize(
    "value",
    [
        "",
        "9FAC2CEED9344F2BBFDD1FDACB0ED9B1",
        "9fac2cee-d934-4f2b-bfdd-1fdacb0ed9b1",
        "9fac2ceed9344f2bbfdd1fdacb0ed9b",
    ],
)
def test_hex_id_rejects(value: str) -> None:
    with pytest.raises(ValueError, match="32 lowercase hex"):
        hex_id(value)


@pytest.mark.parametrize(
    ("value", "expected"), [(1, "1"), (4505281256090153, "4505281256090153"), ("42", "42")]
)
def test_numeric_id_accepts(value: int | str, expected: str) -> None:
    assert numeric_id(value) == expected


@pytest.mark.parametrize("value", [-1, "", "abc", "1.5", "١"])
def test_numeric_id_rejects(value: int | str) -> None:
    with pytest.raises(ValueError, match="string of digits"):
        numeric_id(value)


@pytest.mark.parametrize("value", ["my-project", "my_project", "MyOrg", "123"])
def test_slug_accepts(value: str) -> None:
    assert slug(value) == value


@pytest.mark.parametrize("value", ["", "my project", "my/project", "my.project"])
def test_slug_rejects(value: str) -> None:
    with pytest.raises(ValueError, match="letters, digits"):
        slug(value)


@pytest.mark.parametrize("value", ["user@example.com", "first.last+tag@sub.example.co.uk"])
def test_email_address_accepts(value: str) -> None:
    assert email_address(value) == value


@pytest.mark.parametrize(
    "value", ["", "user", "@example.com", "user@", "a@b@example.com", "user @example.com"]
)
def test_email_address_rejects(value: str) -> None:
    with pytest.raises(ValueError, match="isn't an email address"):
        email_address(value)


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
