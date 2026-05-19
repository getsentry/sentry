from __future__ import annotations

from unittest import mock

from django.http import HttpRequest

from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.requests import (
    make_request,
    make_user_request_from_org,
)
from sentry.testutils.silo import control_silo_test, create_test_cells
from sentry.web.contextprocessors import react_config

react_config_test = control_silo_test(
    cells=create_test_cells("us"),
    include_monolith_run=True,
)


def _prepare_request(request: HttpRequest) -> HttpRequest:
    """Apply attributes normally set by middleware so ``get_client_config`` can
    run against a bare test request."""
    request.subdomain = None
    return request


@react_config_test
@django_db_all
def test_react_config_processor_returns_react_config_key() -> None:
    request, _ = make_user_request_from_org()
    _prepare_request(request)

    result = react_config(request)

    assert set(result) == {"react_config"}
    value = result["react_config"]
    assert isinstance(value, dict)
    # Core keys produced by get_client_config should be present so templates
    # that render {{ react_config|to_json }} produce valid __initialData.
    for key in ("features", "links", "memberRegions", "regions", "sentryConfig"):
        assert key in value


@react_config_test
@django_db_all
def test_react_config_processor_is_memoised_per_request() -> None:
    request, _ = make_user_request_from_org()
    _prepare_request(request)

    first = react_config(request)["react_config"]
    with mock.patch("sentry.web.contextprocessors.get_client_config") as mocked:
        second = react_config(request)["react_config"]

    assert first is second
    mocked.assert_not_called()


@react_config_test
@django_db_all
def test_react_config_processor_reuses_stashed_active_organization() -> None:
    request, _ = make_user_request_from_org()
    _prepare_request(request)

    sentinel = object()
    request._sentry_active_organization = sentinel

    with mock.patch("sentry.web.contextprocessors.get_client_config") as get_client_config_mock:
        get_client_config_mock.return_value = {"ok": True}
        result = react_config(request)

    get_client_config_mock.assert_called_once_with(request, sentinel)
    assert result == {"react_config": {"ok": True}}


@react_config_test
@django_db_all
def test_react_config_processor_passes_none_when_no_active_organization_stashed() -> None:
    """When no view ran ``determine_active_organization`` the processor must
    not trigger an implicit lookup. Its session side effects (setting/clearing
    ``activeorg``) belong in the view layer only."""
    request, _ = make_user_request_from_org()
    _prepare_request(request)

    with mock.patch(
        "sentry.web.contextprocessors.get_client_config", return_value={"ok": True}
    ) as get_client_config_mock:
        result = react_config(request)

    get_client_config_mock.assert_called_once_with(request, None)
    assert result == {"react_config": {"ok": True}}


@react_config_test
@django_db_all
def test_react_config_processor_anonymous_request() -> None:
    """Processor must work for unauthenticated requests (login, 404 pages)."""
    request, _ = make_request()
    _prepare_request(request)

    result = react_config(request)

    value = result["react_config"]
    assert value["isAuthenticated"] is False
    assert value["user"] is None


@react_config_test
@django_db_all
def test_react_config_processor_skips_incomplete_request() -> None:
    """Bare ``WSGIRequest`` objects (constructed by tests / pipeline harnesses
    without middleware) must be skipped so the template render doesn't
    crash on a missing ``session`` / ``user`` attribute. The base layout's
    ``{% if react_config %}`` guard turns the empty return into a valid
    ``window.__initialData = {}`` bootstrap."""
    from django.http import HttpRequest

    bare_request = HttpRequest()
    # No ``session`` or ``user`` set — simulate a request that never went
    # through Django's auth/session middleware.

    result = react_config(bare_request)

    assert result == {}
