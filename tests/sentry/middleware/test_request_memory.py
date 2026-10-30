import os
from collections.abc import Callable, Iterator
from unittest import mock

import pytest
from django.core.exceptions import MiddlewareNotUsed
from django.http import HttpRequest, HttpResponse
from django.http.response import HttpResponseBase
from django.test import RequestFactory
from django.urls import ResolverMatch

from sentry.middleware.request_memory import (
    DEFAULT_THRESHOLD_MB,
    ENABLE_ENV_VAR,
    THRESHOLD_ENV_VAR,
    RequestMemoryMiddleware,
    read_rss_bytes,
    threshold_bytes,
)

MB = 1024 * 1024


@pytest.fixture
def enabled() -> Iterator[None]:
    with mock.patch.dict(os.environ, {ENABLE_ENV_VAR: "1"}):
        os.environ.pop(THRESHOLD_ENV_VAR, None)
        yield


def _fake_rss(values: list[int]) -> Iterator[int]:
    # The first value is consumed by the constructor's probe.
    return iter([0, *values])


def _middleware(rss_values: list[int]) -> RequestMemoryMiddleware:
    values = _fake_rss(rss_values)
    return RequestMemoryMiddleware(
        lambda request: HttpResponse("ok"), read_rss=lambda: next(values)
    )


def _request(url_name: str, **kwargs: str) -> HttpRequest:
    request = RequestFactory().post("/api/0/internal/rpc/organization/get/")
    request.resolver_match = ResolverMatch(lambda r: None, (), kwargs, url_name=url_name)
    return request


def test_off_by_default() -> None:
    with mock.patch.dict(os.environ):
        os.environ.pop(ENABLE_ENV_VAR, None)
        with pytest.raises(MiddlewareNotUsed):
            RequestMemoryMiddleware(lambda request: HttpResponse(), read_rss=lambda: 0)


@pytest.mark.parametrize("value", ["0", "false", "no", "", "maybe"])
def test_off_spellings(value: str) -> None:
    with (
        mock.patch.dict(os.environ, {ENABLE_ENV_VAR: value}),
        pytest.raises(MiddlewareNotUsed),
    ):
        RequestMemoryMiddleware(lambda request: HttpResponse(), read_rss=lambda: 0)


def test_not_used_without_proc(enabled: None) -> None:
    def no_proc() -> int:
        raise FileNotFoundError("/proc/self/statm")

    with pytest.raises(MiddlewareNotUsed):
        RequestMemoryMiddleware(lambda request: HttpResponse(), read_rss=no_proc)


def test_read_rss_bytes_is_positive() -> None:
    assert read_rss_bytes() > 0


@pytest.mark.parametrize(
    ("value", "expected_mb"),
    [("", DEFAULT_THRESHOLD_MB), ("250", 250), ("junk", DEFAULT_THRESHOLD_MB), ("0", 1)],
)
def test_threshold(value: str, expected_mb: int) -> None:
    with mock.patch.dict(os.environ, {THRESHOLD_ENV_VAR: value}):
        assert threshold_bytes() == expected_mb * MB


@mock.patch("sentry.middleware.request_memory.metrics.distribution")
def test_small_growth_is_not_reported(distribution: mock.MagicMock, enabled: None) -> None:
    middleware = _middleware([400 * MB, 450 * MB])
    with mock.patch("sentry.middleware.request_memory.logger") as logger:
        response = middleware(
            _request("sentry-api-0-rpc-service", service_name="a", method_name="b")
        )
    assert response.status_code == 200
    distribution.assert_not_called()
    logger.info.assert_not_called()


@mock.patch("sentry.middleware.request_memory.metrics.distribution")
def test_large_rpc_growth_is_reported(distribution: mock.MagicMock, enabled: None) -> None:
    middleware = _middleware([450 * MB, 1100 * MB])
    request = _request(
        "sentry-api-0-rpc-service", service_name="organization", method_name="get_organization"
    )
    with mock.patch("sentry.middleware.request_memory.logger") as logger:
        middleware(request)

    distribution.assert_called_once_with(
        "middleware.request_rss_growth",
        650,
        tags={
            "url_name": "sentry-api-0-rpc-service",
            "rpc_method": "organization.get_organization",
            "concurrent": "false",
        },
        sample_rate=1.0,
        unit="megabyte",
    )
    logger.info.assert_called_once()
    assert logger.info.call_args.args == ("request.rss_growth",)
    extra = logger.info.call_args.kwargs["extra"]
    assert extra["growth_mb"] == 650
    assert extra["rss_before_mb"] == 450
    assert extra["rss_after_mb"] == 1100
    assert extra["rpc_method"] == "organization.get_organization"
    assert extra["overlapping_requests"] == 0


@mock.patch("sentry.middleware.request_memory.metrics.distribution")
def test_non_rpc_view(distribution: mock.MagicMock, enabled: None) -> None:
    middleware = _middleware([400 * MB, 600 * MB])
    with mock.patch("sentry.middleware.request_memory.logger"):
        middleware(_request("sentry-api-0-organization-details"))
    tags = distribution.call_args.kwargs["tags"]
    assert tags["url_name"] == "sentry-api-0-organization-details"
    assert tags["rpc_method"] == "none"


@mock.patch("sentry.middleware.request_memory.metrics.distribution")
def test_reports_when_the_view_raises(distribution: mock.MagicMock, enabled: None) -> None:
    values = _fake_rss([400 * MB, 800 * MB])

    def boom(request: HttpRequest) -> HttpResponse:
        raise RuntimeError("boom")

    middleware = RequestMemoryMiddleware(boom, read_rss=lambda: next(values))
    with mock.patch("sentry.middleware.request_memory.logger"), pytest.raises(RuntimeError):
        middleware(_request("sentry-api-0-organization-details"))
    distribution.assert_called_once()
    assert distribution.call_args.args[1] == 400


@mock.patch("sentry.middleware.request_memory.metrics.distribution")
def test_failed_read_does_not_fail_the_request(distribution: mock.MagicMock, enabled: None) -> None:
    middleware = RequestMemoryMiddleware(lambda request: HttpResponse("ok"), read_rss=lambda: 0)
    # The read before the view works and the read after it fails.
    with mock.patch.object(middleware, "read_rss", side_effect=[400 * MB, OSError("gone")]):
        response = middleware(_request("sentry-api-0-organization-details"))
    assert response.status_code == 200
    distribution.assert_not_called()


@mock.patch("sentry.middleware.request_memory.metrics.distribution")
def test_marks_a_request_that_overlapped_another(
    distribution: mock.MagicMock, enabled: None
) -> None:
    # The outer request's view runs a second request through the same
    # middleware, so the inner one starts and finishes while the outer one is
    # in flight. RSS: outer before, inner before, inner after, outer after.
    values = _fake_rss([400 * MB, 400 * MB, 400 * MB, 900 * MB])
    inner = _request("inner")
    middleware: RequestMemoryMiddleware
    views: list[Callable[[HttpRequest], HttpResponseBase]] = [
        lambda request: middleware(inner),
        lambda request: HttpResponse(),
    ]
    middleware = RequestMemoryMiddleware(
        lambda request: views.pop(0)(request), read_rss=lambda: next(values)
    )

    with mock.patch("sentry.middleware.request_memory.logger") as logger:
        middleware(_request("outer"))

    distribution.assert_called_once()
    assert distribution.call_args.kwargs["tags"]["url_name"] == "outer"
    assert distribution.call_args.kwargs["tags"]["concurrent"] == "true"
    assert logger.info.call_args.kwargs["extra"]["overlapping_requests"] == 1
